/**
 * Migrate and remove legacy frequency-based Branch KPI fields (BRANCH scope only).
 *
 * Existing monthly history is preserved verbatim. KPI rows without monthly
 * history are converted to monthly storage before legacy fields are removed.
 * AGENT and UNIT documents are not modified.
 * The script is a dry run unless `--apply` is supplied.
 *
 * Usage from the repository root:
 *   node backend/scripts/clear-branch-kpi-frequency-targets.js
 *   node backend/scripts/clear-branch-kpi-frequency-targets.js --apply
 */

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const KpiAssignment = require("../models/KpiAssignment");

const shouldApply = process.argv.includes("--apply");
const MONGO_URI = process.env.MONGO_URI;
const LEGACY_FIELDS = ["period", "assigned", "targetMin", "targetMax", "targetValue", "targets"];

function monthKeyForDate(value = new Date()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonthKey(value = new Date()) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + 1, 1);
  return monthKeyForDate(date);
}

function availableMonthKeys() {
  const keys = [];
  const cursor = new Date("2026-01-01T00:00:00");
  const end = new Date(`${nextMonthKey()}-01T00:00:00`);
  while (cursor <= end) {
    keys.push(monthKeyForDate(cursor));
    cursor.setMonth(cursor.getMonth() + 1, 1);
  }
  return keys;
}

function migrateKpi(kpi = {}) {
  const hasMonthlyHistory = Array.isArray(kpi.monthlyAssignments);
  const monthlyAssignments = hasMonthlyHistory
    ? kpi.monthlyAssignments
    : availableMonthKeys().map((monthKey) => monthKey === monthKeyForDate() ? {
      monthKey,
      assigned: kpi.assigned === true,
      targetMin: kpi.targetMin ?? null,
      targetMax: kpi.targetMax ?? null,
      targetValue: kpi.targetValue ?? null,
    } : { monthKey, assigned: false, targetMin: null, targetMax: null, targetValue: null });

  const cleaned = { ...kpi, monthlyAssignments };
  LEGACY_FIELDS.forEach((field) => delete cleaned[field]);
  return cleaned;
}

async function main() {
  if (!MONGO_URI) throw new Error("Missing MONGO_URI in backend/.env.");
  await mongoose.connect(MONGO_URI);

  const collection = KpiAssignment.collection;
  const assignments = await collection.find(
    { scopeType: "BRANCH" },
    { projection: { scopeId: 1, kpis: 1 } }
  ).toArray();
  const invalidDocuments = assignments.filter((assignment) => !Array.isArray(assignment.kpis));
  const documentsNeedingMonthlyMigration = assignments.filter((assignment) => (
    Array.isArray(assignment.kpis)
    && assignment.kpis.some((kpi) => !Array.isArray(kpi.monthlyAssignments))
  )).length;
  const legacyKpiRows = assignments.reduce((total, assignment) => total + (
    Array.isArray(assignment.kpis)
      ? assignment.kpis.filter((kpi) => LEGACY_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(kpi, field))).length
      : 0
  ), 0);

  console.log({
    mode: shouldApply ? "APPLY" : "DRY RUN",
    branchAssignmentDocuments: assignments.length,
    documentsNeedingMonthlyMigration,
    invalidDocuments: invalidDocuments.length,
    legacyKpiRowsToClean: legacyKpiRows,
    untouchedScopes: ["AGENT", "UNIT"],
  });

  if (!shouldApply) {
    console.log("Dry run only. Re-run with --apply to migrate missing monthly history and remove legacy frequency fields.");
    return;
  }
  if (invalidDocuments.length) {
    throw new Error("Cleanup stopped: at least one Branch KPI assignment has an invalid kpis value.");
  }

  const operations = assignments.map((assignment) => ({
    updateOne: {
      filter: { _id: assignment._id, scopeType: "BRANCH" },
      update: { $set: { kpis: assignment.kpis.map(migrateKpi) } },
    },
  }));
  const result = operations.length ? await collection.bulkWrite(operations) : { matchedCount: 0, modifiedCount: 0 };

  const remainingLegacyRows = await collection.countDocuments({
    scopeType: "BRANCH",
    $or: LEGACY_FIELDS.map((field) => ({ [`kpis.${field}`]: { $exists: true } })),
  });
  const remainingWithoutMonthlyHistory = await collection.countDocuments({
    scopeType: "BRANCH",
    kpis: { $elemMatch: { monthlyAssignments: { $exists: false } } },
  });

  console.log({
    matchedDocuments: result.matchedCount,
    modifiedDocuments: result.modifiedCount,
    remainingDocumentsWithLegacyFrequencyFields: remainingLegacyRows,
    remainingDocumentsWithoutMonthlyHistory,
  });

  if (remainingLegacyRows > 0 || remainingWithoutMonthlyHistory > 0) {
    throw new Error("Cleanup verification failed for Branch KPI assignments.");
  }
}

main()
  .catch((error) => {
    console.error("Branch KPI frequency cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
