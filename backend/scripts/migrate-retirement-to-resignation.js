/**
 * Migrate legacy retirement terminology/data to resignation terminology.
 *
 * - Copies documents from the legacy `retirements` collection into the new
 *   `resignations` collection while renaming retirement* fields to resignation*.
 * - Marks Agent.status values from `Retired` to `Resigned`.
 * - Rewrites related notification entity/metadata terminology.
 *
 * Dry run by default:
 *   node backend/scripts/migrate-retirement-to-resignation.js
 * Apply changes:
 *   node backend/scripts/migrate-retirement-to-resignation.js --apply
 */

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const Agent = require("../models/Agent");
const Notification = require("../models/Notification");
const Resignation = require("../models/Resignation");

const shouldApply = process.argv.includes("--apply");
const MONGO_URI = process.env.MONGO_URI;

const renameRetirementDoc = (doc = {}) => {
  const next = { ...doc };
  if (Object.prototype.hasOwnProperty.call(next, "retirementDate")) {
    next.resignationDate = next.retirementDate;
    delete next.retirementDate;
  }
  if (Object.prototype.hasOwnProperty.call(next, "retirementLetter")) {
    next.resignationLetter = next.retirementLetter;
    delete next.retirementLetter;
  }
  if (Object.prototype.hasOwnProperty.call(next, "approvedRetirementProof")) {
    next.approvedResignationProof = next.approvedRetirementProof;
    delete next.approvedRetirementProof;
  }
  return next;
};

async function main() {
  if (!MONGO_URI) throw new Error("Missing MONGO_URI in backend/.env.");
  await mongoose.connect(MONGO_URI);

  const db = mongoose.connection.db;
  const legacyCollection = db.collection("retirements");
  const resignationsCollection = Resignation.collection;
  const legacyRetirements = await legacyCollection.find({}).toArray();
  const agentsRetired = await Agent.countDocuments({ status: "Retired" });
  const retirementNotifications = await Notification.countDocuments({
    $or: [
      { entityType: "Retirement" },
      { "metadata.endorsementType": "retirement" },
      { "metadata.retirementId": { $exists: true } },
      { "metadata.targetTab": "retirements" },
    ],
  });

  console.log({
    mode: shouldApply ? "APPLY" : "DRY RUN",
    legacyRetirementDocuments: legacyRetirements.length,
    retiredAgentStatuses: agentsRetired,
    retirementNotifications,
  });

  if (!shouldApply) {
    console.log("Dry run only. Re-run with --apply to migrate legacy retirement data.");
    return;
  }

  if (legacyRetirements.length) {
    await resignationsCollection.bulkWrite(
      legacyRetirements.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: renameRetirementDoc(doc),
          upsert: true,
        },
      })),
    );
  }

  const agentResult = await Agent.updateMany({ status: "Retired" }, { $set: { status: "Resigned" } });

  const notificationResult = await Notification.updateMany(
    {
      $or: [
        { entityType: "Retirement" },
        { "metadata.endorsementType": "retirement" },
        { "metadata.retirementId": { $exists: true } },
        { "metadata.retirementDate": { $exists: true } },
        { "metadata.targetTab": "retirements" },
      ],
    },
    [
      {
        $set: {
          entityType: { $cond: [{ $eq: ["$entityType", "Retirement"] }, "Resignation", "$entityType"] },
          title: {
            $replaceAll: {
              input: { $replaceAll: { input: { $ifNull: ["$title", ""] }, find: "retired", replacement: "resigned" } },
              find: "Retirement",
              replacement: "Resignation",
            },
          },
          message: {
            $replaceAll: {
              input: { $replaceAll: { input: { $ifNull: ["$message", ""] }, find: "retirement", replacement: "resignation" } },
              find: "Retirement",
              replacement: "Resignation",
            },
          },
          "metadata.endorsementType": {
            $cond: [{ $eq: ["$metadata.endorsementType", "retirement"] }, "resignation", "$metadata.endorsementType"],
          },
          "metadata.resignationId": { $ifNull: ["$metadata.resignationId", "$metadata.retirementId"] },
          "metadata.resignationDate": { $ifNull: ["$metadata.resignationDate", "$metadata.retirementDate"] },
          "metadata.targetTab": { $cond: [{ $eq: ["$metadata.targetTab", "retirements"] }, "resignations", "$metadata.targetTab"] },
        },
      },
      { $unset: ["metadata.retirementId", "metadata.retirementDate"] },
    ],
    // Mongoose treats an array update as an aggregation pipeline only when this
    // option is explicitly enabled. Without it, --apply fails before any
    // notification terminology can be migrated.
    { updatePipeline: true },
  );

  const migratedCount = await resignationsCollection.countDocuments({});
  console.log({
    copiedOrUpdatedResignationDocuments: legacyRetirements.length,
    totalResignationDocuments: migratedCount,
    agentStatusesMatched: agentResult.matchedCount,
    agentStatusesModified: agentResult.modifiedCount,
    notificationsMatched: notificationResult.matchedCount,
    notificationsModified: notificationResult.modifiedCount,
  });
}

main()
  .catch((error) => {
    console.error("Retirement-to-resignation migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
