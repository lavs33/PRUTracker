/**
 * Backfill Agent status
 * ---------------------
 * Sets status to "Active" for legacy Agent records that do not have a status.
 *
 * Usage:
 *   node backend/scripts/backfill-agent-status-active.js
 *   DRY_RUN=1 node backend/scripts/backfill-agent-status-active.js
 */

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const Agent = require("../models/Agent");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const mongoUri = process.env.MONGO_URI;
  const dryRun = String(process.env.DRY_RUN || "").trim() === "1";

  if (!mongoUri) {
    throw new Error("MONGO_URI is required to backfill agent statuses.");
  }

  await mongoose.connect(mongoUri);

  const missingStatusFilter = {
    $or: [
      { status: { $exists: false } },
      { status: null },
      { status: "" },
    ],
  };

  const agentsMissingStatus = await Agent.countDocuments(missingStatusFilter);

  if (dryRun) {
    console.log(`[DRY RUN] ${agentsMissingStatus} Agent record(s) would be set to Active.`);
    return;
  }

  const result = await Agent.updateMany(missingStatusFilter, { $set: { status: "Active" } });
  console.log(`Matched ${result.matchedCount || 0} Agent record(s).`);
  console.log(`Updated ${result.modifiedCount || 0} Agent record(s) to Active.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
