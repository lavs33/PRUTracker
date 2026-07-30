/**
 * Remove legacy frequency-based Agent KPI assignment fields (AGENT scope only).
 *
 * Monthly assignments (including historical months) are preserved verbatim.
 * UNIT and BRANCH documents are deliberately not modified by this first-phase
 * cleanup.
 * The script is a dry run unless `--apply` is supplied.
 *
 * Usage from the repository root:
 *   node backend/scripts/clear-agent-kpi-frequency-targets.js
 *   node backend/scripts/clear-agent-kpi-frequency-targets.js --apply
 */

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const KpiAssignment = require("../models/KpiAssignment");

const shouldApply = process.argv.includes("--apply");
const MONGO_URI = process.env.MONGO_URI;

async function main() {
  if (!MONGO_URI) throw new Error("Missing MONGO_URI in backend/.env.");
  await mongoose.connect(MONGO_URI);

  // Work against the native collection so Mongoose does not restore legacy
  // schema defaults while the cleanup is removing those fields.
  const collection = KpiAssignment.collection;
  const agentAssignments = await collection.find(
    { scopeType: "AGENT" },
    { projection: { scopeId: 1, kpis: 1 } }
  ).toArray();

  const eligible = agentAssignments.filter((assignment) => (
    Array.isArray(assignment.kpis)
    && assignment.kpis.every((kpi) => Array.isArray(kpi.monthlyAssignments))
  ));
  const skipped = agentAssignments.length - eligible.length;
  const legacyKpiRows = eligible.reduce((total, assignment) => total + assignment.kpis.filter((kpi) => (
    Object.prototype.hasOwnProperty.call(kpi, "period")
    || Object.prototype.hasOwnProperty.call(kpi, "assigned")
    || Object.prototype.hasOwnProperty.call(kpi, "targetMin")
    || Object.prototype.hasOwnProperty.call(kpi, "targetMax")
    || Object.prototype.hasOwnProperty.call(kpi, "targetValue")
    || Object.prototype.hasOwnProperty.call(kpi, "targets")
  )).length, 0);

  console.log({
    mode: shouldApply ? "APPLY" : "DRY RUN",
    agentAssignmentDocuments: agentAssignments.length,
    eligibleDocuments: eligible.length,
    skippedWithoutMonthlyHistory: skipped,
    legacyKpiRowsToClean: legacyKpiRows,
    untouchedScopes: ["UNIT", "BRANCH"],
  });

  if (!shouldApply) {
    console.log("Dry run only. Re-run with --apply to remove legacy frequency fields.");
    return;
  }

  if (skipped > 0) {
    throw new Error("Cleanup stopped: at least one Agent KPI assignment has no monthly history. Load/save monthly assignments before retrying.");
  }

  const result = await collection.updateMany(
    { scopeType: "AGENT" },
    {
      $unset: {
        "kpis.$[].period": "",
        "kpis.$[].assigned": "",
        "kpis.$[].targetMin": "",
        "kpis.$[].targetMax": "",
        "kpis.$[].targetValue": "",
        "kpis.$[].targets": "",
      },
    }
  );

  const remainingLegacyRows = await collection.countDocuments({
    scopeType: "AGENT",
    $or: [
      { "kpis.period": { $exists: true } },
      { "kpis.assigned": { $exists: true } },
      { "kpis.targetMin": { $exists: true } },
      { "kpis.targetMax": { $exists: true } },
      { "kpis.targetValue": { $exists: true } },
      { "kpis.targets": { $exists: true } },
    ],
  });

  console.log({
    matchedDocuments: result.matchedCount,
    modifiedDocuments: result.modifiedCount,
    remainingDocumentsWithLegacyFrequencyFields: remainingLegacyRows,
  });

  if (remainingLegacyRows > 0) throw new Error("Cleanup verification failed: legacy Agent KPI fields remain.");
}

main()
  .catch((error) => {
    console.error("Agent KPI frequency cleanup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
