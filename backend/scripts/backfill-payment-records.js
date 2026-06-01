/**
 * Backfill Payment records
 * ------------------------
 * Builds Payment documents from existing Application and Policy subactivity
 * fields, links those Payment documents back to Application/Policy records, and
 * attaches them to converted Policyholder paymentRecords.
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
const Policyholder = require("../models/Policyholder");
const Payment = require("../models/Payment");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const VALID_FREQUENCIES = new Set(["Monthly", "Quarterly", "Half-yearly", "Yearly"]);

function imageMimeTypeFromDataUrl(dataUrl) {
  return /^data:(image\/(?:jpeg|png));base64,/i.exec(String(dataUrl || ""))?.[1]?.toLowerCase() || "";
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
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
    linkedApplications: 0,
    linkedPolicies: 0,
    linkedPolicyholders: 0,
    unsetPolicyNextPaymentDate: 0,
    dryRun,
  };

  const paymentIdsByEngagementId = new Map();
  const paymentDatesByEngagementId = new Map();
  const frequenciesByEngagementId = new Map();

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

    let paymentId = transfer.paymentId || null;
    if (!dryRun) {
      const paymentDoc = await Payment.findOneAndUpdate(
        { leadEngagementId: application.leadEngagementId },
        {
          $setOnInsert: { leadEngagementId: application.leadEngagementId },
          $set: {
            status: "Pending",
            recordPremiumPaymentTransfer: payload,
          },
        },
        { upsert: true, new: true }
      );
      paymentId = paymentDoc._id;
      summary.updatedPaymentTransfers += 1;

      await Application.updateOne(
        { _id: application._id },
        {
          $set: {
            "recordPremiumPaymentTransfer.paymentId": paymentId,
            "recordPremiumPaymentTransfer.frequencyOfPremiumPayment": frequency,
            "recordPremiumPaymentTransfer.totalAnnualPremiumPhp": transfer.totalAnnualPremiumPhp ?? null,
            "recordPremiumPaymentTransfer.methodForRenewalPayment": transfer.methodForRenewalPayment || "",
            "recordPremiumPaymentTransfer.savedAt": transfer.savedAt || null,
          },
          $unset: {
            "recordPremiumPaymentTransfer.totalFrequencyPremiumPhp": "",
            "recordPremiumPaymentTransfer.paymentDate": "",
            "recordPremiumPaymentTransfer.methodForInitialPayment": "",
            "recordPremiumPaymentTransfer.paymentProofImageDataUrl": "",
            "recordPremiumPaymentTransfer.paymentProofFileName": "",
          },
        }
      );
      summary.linkedApplications += 1;
    } else {
      summary.updatedPaymentTransfers += 1;
      summary.linkedApplications += 1;
    }

    const engagementId = String(application.leadEngagementId || "");
    if (paymentId) paymentIdsByEngagementId.set(engagementId, paymentId);
    if (paymentDate) paymentDatesByEngagementId.set(engagementId, paymentDate);
    if (frequency) frequenciesByEngagementId.set(engagementId, frequency);
  }

  const policies = await Policy.find({
    $or: [
      { "uploadInitialPremiumEor.uploadedAt": { $ne: null } },
      { "recordCoverageDurationDetails.nextPaymentDate": { $exists: true } },
    ],
  })
    .select("leadEngagementId uploadInitialPremiumEor recordCoverageDurationDetails")
    .lean();

  summary.matchedPolicyEors = policies.filter((policy) => policy?.uploadInitialPremiumEor?.uploadedAt).length;

  for (const policy of policies) {
    const engagementId = String(policy.leadEngagementId || "");
    const eor = policy?.uploadInitialPremiumEor || {};
    let paymentId = paymentIdsByEngagementId.get(engagementId) || eor.paymentId || null;

    if (eor.uploadedAt) {
      const payload = {
        eorNumber: String(eor.eorNumber || "").trim(),
        receiptDate: eor.receiptDate || null,
        eorFileName: String(eor.eorFileName || "").trim(),
        eorFileMimeType: String(eor.eorFileMimeType || "application/pdf").trim(),
        eorFileDataUrl: eor.eorFileDataUrl || "",
        uploadedAt: eor.uploadedAt || null,
      };

      if (!dryRun) {
        const paymentDoc = await Payment.findOneAndUpdate(
          paymentId ? { _id: paymentId } : { leadEngagementId: policy.leadEngagementId },
          {
            $setOnInsert: { leadEngagementId: policy.leadEngagementId },
            $set: {
              status: "Processed",
              uploadPremiumPaymentEor: payload,
            },
          },
          { upsert: true, new: true }
        );
        paymentId = paymentDoc._id;
        paymentIdsByEngagementId.set(engagementId, paymentId);
        summary.updatedPremiumPaymentEors += 1;

        await Policy.updateOne(
          { _id: policy._id },
          {
            $set: {
              "uploadInitialPremiumEor.paymentId": paymentId,
              "uploadInitialPremiumEor.uploadedAt": eor.uploadedAt || null,
            },
            $unset: {
              "uploadInitialPremiumEor.eorNumber": "",
              "uploadInitialPremiumEor.receiptDate": "",
              "uploadInitialPremiumEor.eorFileName": "",
              "uploadInitialPremiumEor.eorFileMimeType": "",
              "uploadInitialPremiumEor.eorFileDataUrl": "",
            },
          }
        );
        summary.linkedPolicies += 1;
      } else {
        summary.updatedPremiumPaymentEors += 1;
        summary.linkedPolicies += 1;
      }
    }

    const oldPolicyNextPaymentDate = policy?.recordCoverageDurationDetails?.nextPaymentDate || null;
    if (!dryRun && oldPolicyNextPaymentDate) {
      const result = await Policy.updateOne(
        { _id: policy._id },
        { $unset: { "recordCoverageDurationDetails.nextPaymentDate": "" } }
      );
      summary.unsetPolicyNextPaymentDate += Number(result.modifiedCount || 0);
    } else if (dryRun && oldPolicyNextPaymentDate) {
      summary.unsetPolicyNextPaymentDate += 1;
    }

    const paymentDate = paymentDatesByEngagementId.get(engagementId) || null;
    if (paymentId) {
      const setFields = {};
      if (paymentDate) setFields.lastPaidDate = paymentDate;
      if (oldPolicyNextPaymentDate) setFields.nextPaymentDate = oldPolicyNextPaymentDate;

      if (!dryRun) {
        if (Object.keys(setFields).length) {
          await Policyholder.updateOne({ leadEngagementId: policy.leadEngagementId }, { $set: setFields });
        }
        const result = await Policyholder.updateOne(
          { leadEngagementId: policy.leadEngagementId, "paymentRecords.paymentId": { $ne: paymentId } },
          { $push: { paymentRecords: { paymentId, recordedAt: new Date() } } }
        );
        summary.linkedPolicyholders += Number(result.modifiedCount || 0);
      } else {
        summary.linkedPolicyholders += 1;
      }
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
