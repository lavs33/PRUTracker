/**
 * Backfill Payment records
 * ------------------------
 * Builds Payment documents from the existing Application and Policy subactivity
 * fields so historical payment-transfer and eOR uploads are available in the
 * dedicated Payment collection.
 *
 * Usage:
 *   node backend/scripts/backfill-payment-records.js
 *   DRY_RUN=1 node backend/scripts/backfill-payment-records.js
 */

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Application = require("../models/Application");
const Policy = require("../models/Policy");
const Payment = require("../models/Payment");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const VALID_FREQUENCIES = new Set(["Monthly", "Quarterly", "Half-yearly", "Yearly"]);

function imageMimeTypeFromDataUrl(dataUrl) {
  return /^data:(image\/(?:jpeg|png));base64,/i.exec(String(dataUrl || ""))?.[1]?.toLowerCase() || "";
}

async function backfillPaymentRecords() {
  const mongoUri = process.env.MONGO_URI;
  const dryRun = String(process.env.DRY_RUN || "").trim() === "1";

  if (!mongoUri) throw new Error("Missing MONGO_URI in environment (.env).");

  await mongoose.connect(mongoUri);

  const summary = {
    matchedApplicationPayments: 0,
    updatedPaymentTransfers: 0,
    skippedInvalidApplicationFrequency: 0,
    matchedPolicyEors: 0,
    updatedPremiumPaymentEors: 0,
    dryRun,
  };

  const applications = await Application.find({
    "recordPremiumPaymentTransfer.savedAt": { $ne: null },
  })
    .select("leadEngagementId recordPremiumPaymentTransfer")
    .lean();

  summary.matchedApplicationPayments = applications.length;

  for (const application of applications) {
    const transfer = application?.recordPremiumPaymentTransfer || {};
    const frequency = String(transfer.frequencyOfPremiumPayment || "").trim();
    if (frequency && !VALID_FREQUENCIES.has(frequency)) {
      summary.skippedInvalidApplicationFrequency += 1;
      continue;
    }

    const paymentDate = transfer.paymentDate || transfer.savedAt || null;
    const payload = {
      totalPremiumPaidPhp: transfer.totalFrequencyPremiumPhp ?? null,
      frequencyOfPremiumPayment: frequency,
      paymentDate,
      methodForPayment: String(transfer.methodForInitialPayment || "").trim(),
      proofOfPaymentFileName: String(transfer.paymentProofFileName || "").trim(),
      proofOfPaymentFileMimeType: imageMimeTypeFromDataUrl(transfer.paymentProofImageDataUrl),
      proofOfPaymentFileDataUrl: transfer.paymentProofImageDataUrl || "",
      savedAt: transfer.savedAt || null,
    };

    if (!dryRun) {
      const result = await Payment.updateOne(
        { leadEngagementId: application.leadEngagementId },
        {
          $setOnInsert: { leadEngagementId: application.leadEngagementId },
          $set: { recordPremiumPaymentTransfer: payload },
        },
        { upsert: true }
      );
      summary.updatedPaymentTransfers += Number(result.modifiedCount || result.upsertedCount || 0);
    } else {
      summary.updatedPaymentTransfers += 1;
    }
  }

  const policies = await Policy.find({
    "uploadInitialPremiumEor.uploadedAt": { $ne: null },
  })
    .select("leadEngagementId uploadInitialPremiumEor")
    .lean();

  summary.matchedPolicyEors = policies.length;

  for (const policy of policies) {
    const eor = policy?.uploadInitialPremiumEor || {};
    const payload = {
      eorNumber: String(eor.eorNumber || "").trim(),
      receiptDate: eor.receiptDate || null,
      eorFileName: String(eor.eorFileName || "").trim(),
      eorFileMimeType: String(eor.eorFileMimeType || "application/pdf").trim(),
      eorFileDataUrl: eor.eorFileDataUrl || "",
      uploadedAt: eor.uploadedAt || null,
    };

    if (!dryRun) {
      const result = await Payment.updateOne(
        { leadEngagementId: policy.leadEngagementId },
        {
          $setOnInsert: { leadEngagementId: policy.leadEngagementId },
          $set: { uploadPremiumPaymentEor: payload },
        },
        { upsert: true }
      );
      summary.updatedPremiumPaymentEors += Number(result.modifiedCount || result.upsertedCount || 0);
    } else {
      summary.updatedPremiumPaymentEors += 1;
    }
  }

  console.log("Payment record backfill complete.");
  console.log(summary);
}

backfillPaymentRecords()
  .catch((err) => {
    console.error("Payment record backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
