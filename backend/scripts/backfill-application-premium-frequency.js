/**
 * Backfill Application premium payment frequency
 * ------------------------------------------------
 * Populates recordPremiumPaymentTransfer.frequencyOfPremiumPayment for existing
 * Application documents from the matching Needs Assessment requested frequency.
 *
 * This preserves the old behavior for historical records. New records should
 * still use the manually selected final application frequency from the UI.
 *
 * Usage:
 *   node backend/scripts/backfill-application-premium-frequency.js
 *   DRY_RUN=1 node backend/scripts/backfill-application-premium-frequency.js
 */

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Application = require("../models/Application");
const NeedsAssessment = require("../models/NeedsAssessment");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const VALID_FREQUENCIES = new Set(["Monthly", "Quarterly", "Half-yearly", "Yearly"]);
const MISSING_FREQUENCY_FILTER = {
  $or: [
    { "recordPremiumPaymentTransfer.frequencyOfPremiumPayment": { $exists: false } },
    { "recordPremiumPaymentTransfer.frequencyOfPremiumPayment": null },
    { "recordPremiumPaymentTransfer.frequencyOfPremiumPayment": "" },
  ],
};

async function backfillApplicationPremiumFrequency() {
  const mongoUri = process.env.MONGO_URI;
  const dryRun = String(process.env.DRY_RUN || "").trim() === "1";

  if (!mongoUri) {
    throw new Error("Missing MONGO_URI in environment (.env).");
  }

  await mongoose.connect(mongoUri);

  const summary = {
    matchedApplications: 0,
    updatedApplications: 0,
    skippedNoNeedsAssessment: 0,
    skippedInvalidRequestedFrequency: 0,
    dryRun,
  };

  const applications = await Application.find(MISSING_FREQUENCY_FILTER)
    .select("_id leadEngagementId")
    .lean();

  summary.matchedApplications = applications.length;

  for (const application of applications) {
    const needsAssessment = await NeedsAssessment.findOne({ leadEngagementId: application.leadEngagementId })
      .select("needsPriorities.productSelection.requestedFrequency")
      .lean();

    if (!needsAssessment) {
      summary.skippedNoNeedsAssessment += 1;
      continue;
    }

    const requestedFrequency = String(needsAssessment?.needsPriorities?.productSelection?.requestedFrequency || "").trim();
    if (!VALID_FREQUENCIES.has(requestedFrequency)) {
      summary.skippedInvalidRequestedFrequency += 1;
      continue;
    }

    if (!dryRun) {
      const result = await Application.updateOne(
        { _id: application._id, ...MISSING_FREQUENCY_FILTER },
        { $set: { "recordPremiumPaymentTransfer.frequencyOfPremiumPayment": requestedFrequency } }
      );
      summary.updatedApplications += Number(result.modifiedCount || 0);
    } else {
      summary.updatedApplications += 1;
    }
  }

  console.log("Application premium frequency backfill complete.");
  console.log(summary);
}

backfillApplicationPremiumFrequency()
  .catch((err) => {
    console.error("Application premium frequency backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
