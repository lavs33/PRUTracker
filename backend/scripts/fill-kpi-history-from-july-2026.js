/**
 * Backfill January-June 2026 KPI assignments from each KPI's July 2026 row.
 *
 * Every KPI in every AGENT, UNIT, and BRANCH assignment document is included.
 * Existing January-June rows are overwritten with July's target and marked
 * assigned. July and all other months are preserved. Dry-run unless `--apply`.
 *
 * Usage from the repository root:
 *   node backend/scripts/fill-kpi-history-from-july-2026.js
 *   node backend/scripts/fill-kpi-history-from-july-2026.js --apply
 */

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const KpiAssignment = require("../models/KpiAssignment");

const shouldApply = process.argv.includes("--apply");
const MONGO_URI = process.env.MONGO_URI;
const SOURCE_MONTH = "2026-07";
const HISTORY_MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
const SCOPES = ["AGENT", "UNIT", "BRANCH"];

function hasTarget(row = {}) {
  return [row.targetMin, row.targetMax, row.targetValue]
    .some((value) => value !== null && value !== undefined);
}

function validateAssignment(assignment) {
  if (!Array.isArray(assignment.kpis)) return ["kpis is not an array"];
  return assignment.kpis.flatMap((kpi) => {
    const label = String(kpi?.key || kpi?.label || "Unknown KPI");
    if (!Array.isArray(kpi?.monthlyAssignments)) return [`${label}: monthlyAssignments is not an array`];
    const july = kpi.monthlyAssignments.find((row) => row?.monthKey === SOURCE_MONTH);
    if (!july) return [`${label}: July 2026 assignment is missing`];
    if (july.assigned !== true) return [`${label}: July 2026 is unassigned`];
    if (!hasTarget(july)) return [`${label}: July 2026 has no target`];
    return [];
  });
}

function backfillKpi(kpi) {
  const july = kpi.monthlyAssignments.find((row) => row.monthKey === SOURCE_MONTH);
  const historyByMonth = new Map(kpi.monthlyAssignments.map((row) => [row.monthKey, row]));
  HISTORY_MONTHS.forEach((monthKey) => {
    historyByMonth.set(monthKey, {
      monthKey,
      assigned: true,
      targetMin: july.targetMin ?? null,
      targetMax: july.targetMax ?? null,
      targetValue: july.targetValue ?? null,
    });
  });
  return {
    ...kpi,
    monthlyAssignments: [...historyByMonth.values()].sort((left, right) => left.monthKey.localeCompare(right.monthKey)),
  };
}

function countHistoryRows(assignments) {
  return assignments.reduce((total, assignment) => total + assignment.kpis.reduce(
    (kpiTotal, kpi) => kpiTotal + kpi.monthlyAssignments.filter((row) => HISTORY_MONTHS.includes(row.monthKey)).length,
    0
  ), 0);
}

function countHistoryMismatches(assignments) {
  return assignments.reduce((total, assignment) => total + assignment.kpis.reduce((kpiTotal, kpi) => {
    const july = kpi.monthlyAssignments.find((row) => row.monthKey === SOURCE_MONTH);
    return kpiTotal + HISTORY_MONTHS.filter((monthKey) => {
      const row = kpi.monthlyAssignments.find((candidate) => candidate.monthKey === monthKey);
      return !row
        || row.assigned !== true
        || row.targetMin !== (july.targetMin ?? null)
        || row.targetMax !== (july.targetMax ?? null)
        || row.targetValue !== (july.targetValue ?? null);
    }).length;
  }, 0), 0);
}

async function main() {
  if (!MONGO_URI) throw new Error("Missing MONGO_URI in backend/.env.");
  await mongoose.connect(MONGO_URI);

  const collection = KpiAssignment.collection;
  const assignments = await collection.find(
    { scopeType: { $in: SCOPES } },
    { projection: { scopeType: 1, scopeId: 1, kpis: 1 } }
  ).toArray();
  const validationFailures = assignments.flatMap((assignment) => validateAssignment(assignment).map((reason) => ({
    assignmentId: String(assignment._id),
    scopeType: assignment.scopeType,
    reason,
  })));

  console.log({
    mode: shouldApply ? "APPLY" : "DRY RUN",
    sourceMonth: SOURCE_MONTH,
    historyMonths: HISTORY_MONTHS,
    assignmentDocuments: assignments.length,
    kpiRows: assignments.reduce((total, assignment) => total + (Array.isArray(assignment.kpis) ? assignment.kpis.length : 0), 0),
    validationFailures: validationFailures.length,
  });
  if (validationFailures.length) console.table(validationFailures);

  if (!shouldApply) {
    console.log("Dry run only. Re-run with --apply after all validation failures are resolved.");
    return;
  }
  if (validationFailures.length) {
    throw new Error("Backfill stopped: every KPI must have an assigned July 2026 target before history can be filled.");
  }

  const operations = assignments.map((assignment) => ({
    updateOne: {
      filter: { _id: assignment._id, scopeType: assignment.scopeType },
      update: { $set: { kpis: assignment.kpis.map(backfillKpi) } },
    },
  }));
  const result = operations.length ? await collection.bulkWrite(operations) : { matchedCount: 0, modifiedCount: 0 };
  const updatedAssignments = await collection.find(
    { _id: { $in: assignments.map((assignment) => assignment._id) } },
    { projection: { kpis: 1 } }
  ).toArray();
  const expectedHistoryRows = assignments.reduce(
    (total, assignment) => total + assignment.kpis.length * HISTORY_MONTHS.length,
    0
  );
  const persistedHistoryRows = countHistoryRows(updatedAssignments);
  const historyMismatches = countHistoryMismatches(updatedAssignments);

  console.log({
    matchedDocuments: result.matchedCount,
    modifiedDocuments: result.modifiedCount,
    expectedHistoryRows,
    persistedHistoryRows,
    historyMismatches,
  });
  if (persistedHistoryRows !== expectedHistoryRows || historyMismatches > 0) {
    throw new Error("Backfill verification failed: not all January-June 2026 KPI rows were persisted.");
  }
}

main()
  .catch((error) => {
    console.error("KPI history backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
