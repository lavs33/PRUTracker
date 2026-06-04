/**
 * Backfill Payment records
 * ------------------------
 * Builds Payment documents from existing Application and Policy subactivity
 * fields, links those Payment documents back to Application/Policy records, and
 * does not attach them to Policyholder records; annual payment migration handles policyholder links.
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

function formatPaymentPeriodDate(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function derivePaymentPeriod(paymentDate, frequency) {
  const startDate = paymentDate ? new Date(paymentDate) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) {
    return { startDate: null, endDate: null, label: "" };
  }

  const intervalMonthsByFrequency = {
    Monthly: 1,
    Quarterly: 3,
    "Half-yearly": 6,
    Yearly: 12,
  };
  const intervalMonths = intervalMonthsByFrequency[String(frequency || "").trim()] || 0;
  if (!intervalMonths) {
    return { startDate, endDate: null, label: "" };
  }

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + intervalMonths);
  endDate.setDate(endDate.getDate() - 1);

  return {
    startDate,
    endDate,
    label: `${formatPaymentPeriodDate(startDate)} - ${formatPaymentPeriodDate(endDate)}`,
  };
}

function imageMimeTypeFromDataUrl(dataUrl) {
  return /^data:(image\/(?:jpeg|png));base64,/i.exec(String(dataUrl || ""))?.[1]?.toLowerCase() || "";
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function hasMeaningfulLegacyTransferData(transfer = {}) {
  return Boolean(
    transfer.savedAt
    || transfer.paymentDate
    || transfer.totalFrequencyPremiumPhp !== undefined && transfer.totalFrequencyPremiumPhp !== null
    || String(transfer.methodForInitialPayment || "").trim()
    || String(transfer.paymentProofImageDataUrl || "").trim()
    || String(transfer.paymentProofFileName || "").trim()
  );
}

function hasApplicationPremiumSelectionData(transfer = {}) {
  return Boolean(
    String(transfer.frequencyOfPremiumPayment || "").trim()
    || transfer.totalAnnualPremiumPhp !== undefined && transfer.totalAnnualPremiumPhp !== null
    || String(transfer.methodForRenewalPayment || "").trim()
  );
}

function hasMeaningfulPaymentTransferData(payment = {}) {
  const transfer = payment?.recordPremiumPaymentTransfer || {};
  return Boolean(
    transfer.savedAt
    || transfer.paymentDate
    || transfer.totalPremiumPaidPhp !== undefined && transfer.totalPremiumPaidPhp !== null
    || String(transfer.methodForPayment || "").trim()
    || String(transfer.proofOfPaymentFileDataUrl || "").trim()
    || String(transfer.proofOfPaymentFileName || "").trim()
  );
}

function hasMeaningfulPaymentEorData(payment = {}) {
  const eor = payment?.uploadPremiumPaymentEor || {};
  return Boolean(
    eor.uploadedAt
    || eor.receiptDate
    || String(eor.eorNumber || "").trim()
    || String(eor.eorFileName || "").trim()
    || String(eor.eorFileDataUrl || "").trim()
  );
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
    cleanedLegacyApplicationFields: 0,
    cleanedLegacyPolicyFields: 0,
    unlinkedIncompleteApplicationPayments: 0,
    unlinkedBlankPolicyPayments: 0,
    relinkedApplicationPayments: 0,
    deletedEmptyPayments: 0,
    deletedOrphanBlankPayments: 0,
    dryRun,
  };

  const paymentIdsByEngagementId = new Map();
  const paymentDatesByEngagementId = new Map();
  const frequenciesByEngagementId = new Map();

  const applications = await Application.find({
    $or: [
      { "recordPremiumPaymentTransfer.paymentId": { $ne: null } },
      { "recordPremiumPaymentTransfer.savedAt": { $exists: true } },
      { "recordPremiumPaymentTransfer.frequencyOfPremiumPayment": { $exists: true } },
      { "recordPremiumPaymentTransfer.totalAnnualPremiumPhp": { $exists: true } },
      { "recordPremiumPaymentTransfer.totalFrequencyPremiumPhp": { $exists: true } },
      { "recordPremiumPaymentTransfer.paymentDate": { $exists: true } },
      { "recordPremiumPaymentTransfer.methodForInitialPayment": { $exists: true } },
      { "recordPremiumPaymentTransfer.paymentProofImageDataUrl": { $exists: true } },
      { "recordPremiumPaymentTransfer.paymentProofFileName": { $exists: true } },
    ],
  })
    .select("leadEngagementId recordPremiumPaymentTransfer")
    .lean();

  summary.matchedApplicationPayments = applications.length;

  for (const application of applications) {
    const transfer = application?.recordPremiumPaymentTransfer || {};
    const frequency = String(transfer.frequencyOfPremiumPayment || "").trim();
    const isValidFrequency = !frequency || VALID_FREQUENCIES.has(frequency);
    if (!isValidFrequency) summary.skippedInvalidApplicationFrequency += 1;
    const frequencyForStorage = isValidFrequency ? frequency : "";

    const hasLegacyTransferData = Boolean(
      Object.prototype.hasOwnProperty.call(transfer, "savedAt")
      || Object.prototype.hasOwnProperty.call(transfer, "totalFrequencyPremiumPhp")
      || Object.prototype.hasOwnProperty.call(transfer, "paymentDate")
      || Object.prototype.hasOwnProperty.call(transfer, "methodForInitialPayment")
      || Object.prototype.hasOwnProperty.call(transfer, "paymentProofImageDataUrl")
      || Object.prototype.hasOwnProperty.call(transfer, "paymentProofFileName")
    );
    const hasCompletedPremiumTransfer = hasMeaningfulLegacyTransferData(transfer);
    const hasApplicationPremiumSelection = hasApplicationPremiumSelectionData(transfer);

    const paymentDate = transfer.paymentDate || transfer.savedAt || null;
    const payload = {
      totalPremiumPaidPhp: transfer.totalFrequencyPremiumPhp ?? null,
      frequencyOfPremiumPayment: frequencyForStorage,
      paymentDate,
      paymentPeriod: derivePaymentPeriod(paymentDate, frequencyForStorage),
      methodForPayment: String(transfer.methodForInitialPayment || "").trim(),
      proofOfPaymentFileName: String(transfer.paymentProofFileName || "").trim(),
      proofOfPaymentFileMimeType: imageMimeTypeFromDataUrl(transfer.paymentProofImageDataUrl),
      proofOfPaymentFileDataUrl: transfer.paymentProofImageDataUrl || "",
      savedAt: transfer.savedAt || null,
    };

    let paymentId = transfer.paymentId || null;
    let linkedPaymentHasCompletedTransfer = false;
    if (paymentId) {
      const linkedPayment = await Payment.findById(paymentId)
        .select("recordPremiumPaymentTransfer")
        .lean();
      linkedPaymentHasCompletedTransfer = hasMeaningfulPaymentTransferData(linkedPayment);
    }
    const shouldKeepExistingPaymentId = Boolean(paymentId && linkedPaymentHasCompletedTransfer);
    if (!dryRun && hasCompletedPremiumTransfer) {
      const existingPaymentDoc = await Payment.findOne({ leadEngagementId: application.leadEngagementId })
        .select("status")
        .lean();
      const nextStatus = String(existingPaymentDoc?.status || "") === "Processed" ? "Processed" : "Pending";
      const paymentDoc = await Payment.findOneAndUpdate(
        { leadEngagementId: application.leadEngagementId },
        {
          $setOnInsert: { leadEngagementId: application.leadEngagementId },
          $set: {
            status: nextStatus,
            recordPremiumPaymentTransfer: payload,
          },
        },
        { upsert: true, new: true }
      );
      paymentId = paymentDoc._id;
      summary.updatedPaymentTransfers += 1;
    } else if (dryRun && hasCompletedPremiumTransfer) {
      summary.updatedPaymentTransfers += 1;
    }

    const applicationSet = {
      "recordPremiumPaymentTransfer.methodForRenewalPayment": transfer.methodForRenewalPayment || "",
    };
    if ((hasCompletedPremiumTransfer || shouldKeepExistingPaymentId) && paymentId) applicationSet["recordPremiumPaymentTransfer.paymentId"] = paymentId;

    if (!dryRun) {
      const result = await Application.collection.updateOne(
        { _id: application._id },
        {
          $set: applicationSet,
          $unset: {
            "recordPremiumPaymentTransfer.totalFrequencyPremiumPhp": "",
            "recordPremiumPaymentTransfer.paymentDate": "",
            "recordPremiumPaymentTransfer.methodForInitialPayment": "",
            "recordPremiumPaymentTransfer.paymentProofImageDataUrl": "",
            "recordPremiumPaymentTransfer.paymentProofFileName": "",
            "recordPremiumPaymentTransfer.savedAt": "",
            "recordPremiumPaymentTransfer.frequencyOfPremiumPayment": "",
            "recordPremiumPaymentTransfer.totalAnnualPremiumPhp": "",
            ...(!hasCompletedPremiumTransfer && !shouldKeepExistingPaymentId ? { "recordPremiumPaymentTransfer.paymentId": "" } : {}),
          },
        }
      );
      summary.linkedApplications += Number(result.modifiedCount || 0);
    } else {
      summary.linkedApplications += 1;
    }

    const engagementId = String(application.leadEngagementId || "");
    if ((hasCompletedPremiumTransfer || shouldKeepExistingPaymentId) && paymentId) paymentIdsByEngagementId.set(engagementId, paymentId);
    if (paymentDate) paymentDatesByEngagementId.set(engagementId, paymentDate);
    if (frequency) frequenciesByEngagementId.set(engagementId, frequency);
  }

  const policies = await Policy.find({
    $or: [
      { "uploadInitialPremiumEor.uploadedAt": { $ne: null } },
      { "uploadInitialPremiumEor.eorNumber": { $exists: true, $ne: "" } },
      { "uploadInitialPremiumEor.receiptDate": { $ne: null } },
      { "uploadInitialPremiumEor.eorFileName": { $exists: true, $ne: "" } },
      { "uploadInitialPremiumEor.eorFileDataUrl": { $exists: true, $ne: "" } },
      { "recordCoverageDurationDetails.nextPaymentDate": { $exists: true } },
    ],
  })
    .select("leadEngagementId uploadInitialPremiumEor recordCoverageDurationDetails")
    .lean();

  summary.matchedPolicyEors = policies.filter((policy) => {
    const eor = policy?.uploadInitialPremiumEor || {};
    return Boolean(eor.uploadedAt || eor.eorNumber || eor.receiptDate || eor.eorFileName || eor.eorFileDataUrl);
  }).length;

  for (const policy of policies) {
    const engagementId = String(policy.leadEngagementId || "");
    const eor = policy?.uploadInitialPremiumEor || {};
    let paymentId = paymentIdsByEngagementId.get(engagementId) || eor.paymentId || null;

    const hasLegacyEorData = Boolean(eor.uploadedAt || eor.eorNumber || eor.receiptDate || eor.eorFileName || eor.eorFileDataUrl);

    if (hasLegacyEorData) {
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

        const policyLinkResult = await Policy.collection.updateOne(
          { _id: policy._id },
          {
            $set: {
              "uploadInitialPremiumEor.paymentId": paymentId,
            },
            $unset: {
              "uploadInitialPremiumEor.uploadedAt": "",
              "uploadInitialPremiumEor.eorNumber": "",
              "uploadInitialPremiumEor.receiptDate": "",
              "uploadInitialPremiumEor.eorFileName": "",
              "uploadInitialPremiumEor.eorFileMimeType": "",
              "uploadInitialPremiumEor.eorFileDataUrl": "",
            },
          }
        );
        summary.linkedPolicies += Number(policyLinkResult.modifiedCount || 0);
      } else {
        summary.updatedPremiumPaymentEors += 1;
        summary.linkedPolicies += 1;
      }
    }

    const hasLegacyPolicyNextPaymentDate = Object.prototype.hasOwnProperty.call(
      policy?.recordCoverageDurationDetails || {},
      "nextPaymentDate"
    );
    const oldPolicyNextPaymentDate = policy?.recordCoverageDurationDetails?.nextPaymentDate || null;
    if (!dryRun && hasLegacyPolicyNextPaymentDate) {
      const result = await Policy.collection.updateOne(
        { _id: policy._id },
        { $unset: { "recordCoverageDurationDetails.nextPaymentDate": "" } }
      );
      summary.unsetPolicyNextPaymentDate += Number(result.modifiedCount || 0);
    } else if (dryRun && hasLegacyPolicyNextPaymentDate) {
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
summary.linkedPolicyholders += 0;
      } else {
        summary.linkedPolicyholders += 1;
      }
    }
  }

  const applicationsMissingPaymentRefs = await Application.find({
    $or: [
      { "recordPremiumPaymentTransfer.paymentId": null },
      { "recordPremiumPaymentTransfer.paymentId": { $exists: false } },
    ],
  })
    .select("leadEngagementId recordPremiumPaymentTransfer")
    .lean();

  for (const application of applicationsMissingPaymentRefs) {
    const transfer = application?.recordPremiumPaymentTransfer || {};
    if (!hasApplicationPremiumSelectionData(transfer)) continue;
    const payment = await Payment.findOne({ leadEngagementId: application.leadEngagementId })
      .select("_id recordPremiumPaymentTransfer uploadPremiumPaymentEor")
      .lean();
    if (!payment?._id || !hasMeaningfulPaymentTransferData(payment)) continue;

    if (!dryRun) {
      const relinkResult = await Application.collection.updateOne(
        { _id: application._id },
        { $set: { "recordPremiumPaymentTransfer.paymentId": payment._id } }
      );
      summary.relinkedApplicationPayments += Number(relinkResult.modifiedCount || 0);
    } else {
      summary.relinkedApplicationPayments += 1;
    }
  }

  const applicationsWithPaymentRefs = await Application.find({
    "recordPremiumPaymentTransfer.paymentId": { $ne: null },
  })
    .select("recordPremiumPaymentTransfer")
    .lean();

  const emptyPaymentIdsToDelete = new Set();
  for (const application of applicationsWithPaymentRefs) {
    const paymentId = application?.recordPremiumPaymentTransfer?.paymentId;
    if (!paymentId) continue;
    const payment = await Payment.findById(paymentId)
      .select("recordPremiumPaymentTransfer uploadPremiumPaymentEor")
      .lean();
    const hasTransfer = hasMeaningfulPaymentTransferData(payment);
    if (hasTransfer) continue;

    if (!dryRun) {
      const unlinkResult = await Application.collection.updateOne(
        { _id: application._id },
        { $unset: { "recordPremiumPaymentTransfer.paymentId": "" } }
      );
      summary.unlinkedIncompleteApplicationPayments += Number(unlinkResult.modifiedCount || 0);
    } else {
      summary.unlinkedIncompleteApplicationPayments += 1;
    }

    if (payment?._id && !hasMeaningfulPaymentEorData(payment)) {
      emptyPaymentIdsToDelete.add(String(payment._id));
    }
  }

  if (emptyPaymentIdsToDelete.size) {
    const emptyPaymentObjectIds = [...emptyPaymentIdsToDelete]
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (!dryRun) {
      const deleteResult = await Payment.deleteMany({ _id: { $in: emptyPaymentObjectIds } });
      summary.deletedEmptyPayments = Number(deleteResult.deletedCount || 0);
    } else {
      summary.deletedEmptyPayments = emptyPaymentObjectIds.length;
    }
  }

  const policiesWithPaymentRefs = await Policy.find({
    "uploadInitialPremiumEor.paymentId": { $ne: null },
  })
    .select("uploadInitialPremiumEor.paymentId")
    .lean();

  const blankPolicyPaymentIdsToDelete = new Set();
  for (const policy of policiesWithPaymentRefs) {
    const paymentId = policy?.uploadInitialPremiumEor?.paymentId;
    if (!paymentId) continue;
    const payment = await Payment.findById(paymentId)
      .select("recordPremiumPaymentTransfer uploadPremiumPaymentEor")
      .lean();
    if (hasMeaningfulPaymentTransferData(payment) || hasMeaningfulPaymentEorData(payment)) continue;

    if (!dryRun) {
      const unlinkResult = await Policy.collection.updateOne(
        { _id: policy._id },
        { $unset: { "uploadInitialPremiumEor.paymentId": "" } }
      );
      summary.unlinkedBlankPolicyPayments += Number(unlinkResult.modifiedCount || 0);
    } else {
      summary.unlinkedBlankPolicyPayments += 1;
    }

    if (payment?._id) blankPolicyPaymentIdsToDelete.add(String(payment._id));
  }

  if (blankPolicyPaymentIdsToDelete.size) {
    const blankPolicyPaymentObjectIds = [...blankPolicyPaymentIdsToDelete]
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (!dryRun) {
      const deleteResult = await Payment.deleteMany({ _id: { $in: blankPolicyPaymentObjectIds } });
      summary.deletedEmptyPayments += Number(deleteResult.deletedCount || 0);
    } else {
      summary.deletedEmptyPayments += blankPolicyPaymentObjectIds.length;
    }
  }

  const blankPayments = await Payment.find({})
    .select("recordPremiumPaymentTransfer uploadPremiumPaymentEor")
    .lean();
  const blankPaymentIds = blankPayments
    .filter((payment) => !hasMeaningfulPaymentTransferData(payment) && !hasMeaningfulPaymentEorData(payment))
    .map((payment) => payment._id);
  if (blankPaymentIds.length) {
    const [referencedByApplication, referencedByPolicy, referencedByPolicyholder] = await Promise.all([
      Application.find({ "recordPremiumPaymentTransfer.paymentId": { $in: blankPaymentIds } }).distinct("recordPremiumPaymentTransfer.paymentId"),
      Policy.find({ "uploadInitialPremiumEor.paymentId": { $in: blankPaymentIds } }).distinct("uploadInitialPremiumEor.paymentId"),
      Policyholder.collection.distinct("paymentRecords.paymentId", { "paymentRecords.paymentId": { $in: blankPaymentIds } }),
    ]);
    const referencedPaymentIds = new Set([
      ...referencedByApplication,
      ...referencedByPolicy,
      ...referencedByPolicyholder,
    ].map((id) => String(id)));
    const orphanBlankPaymentIds = blankPaymentIds.filter((id) => !referencedPaymentIds.has(String(id)));
    if (orphanBlankPaymentIds.length) {
      if (!dryRun) {
        const deleteResult = await Payment.deleteMany({ _id: { $in: orphanBlankPaymentIds } });
        summary.deletedOrphanBlankPayments = Number(deleteResult.deletedCount || 0);
      } else {
        summary.deletedOrphanBlankPayments = orphanBlankPaymentIds.length;
      }
    }
  }

  const legacyApplicationCleanupFilter = {
    $or: [
      { "recordPremiumPaymentTransfer.totalFrequencyPremiumPhp": { $exists: true } },
      { "recordPremiumPaymentTransfer.paymentDate": { $exists: true } },
      { "recordPremiumPaymentTransfer.methodForInitialPayment": { $exists: true } },
      { "recordPremiumPaymentTransfer.paymentProofImageDataUrl": { $exists: true } },
      { "recordPremiumPaymentTransfer.paymentProofFileName": { $exists: true } },
      { "recordPremiumPaymentTransfer.savedAt": { $exists: true } },
      { "recordPremiumPaymentTransfer.frequencyOfPremiumPayment": { $exists: true } },
      { "recordPremiumPaymentTransfer.totalAnnualPremiumPhp": { $exists: true } },
    ],
  };
  const legacyApplicationUnset = {
    "recordPremiumPaymentTransfer.totalFrequencyPremiumPhp": "",
    "recordPremiumPaymentTransfer.paymentDate": "",
    "recordPremiumPaymentTransfer.methodForInitialPayment": "",
    "recordPremiumPaymentTransfer.paymentProofImageDataUrl": "",
    "recordPremiumPaymentTransfer.paymentProofFileName": "",
    "recordPremiumPaymentTransfer.savedAt": "",
    "recordPremiumPaymentTransfer.frequencyOfPremiumPayment": "",
    "recordPremiumPaymentTransfer.totalAnnualPremiumPhp": "",
  };
  const legacyPolicyCleanupFilter = {
    $or: [
      { "uploadInitialPremiumEor.uploadedAt": { $exists: true } },
      { "uploadInitialPremiumEor.eorNumber": { $exists: true } },
      { "uploadInitialPremiumEor.receiptDate": { $exists: true } },
      { "uploadInitialPremiumEor.eorFileName": { $exists: true } },
      { "uploadInitialPremiumEor.eorFileMimeType": { $exists: true } },
      { "uploadInitialPremiumEor.eorFileDataUrl": { $exists: true } },
      { "recordCoverageDurationDetails.nextPaymentDate": { $exists: true } },
    ],
  };
  const legacyPolicyUnset = {
    "uploadInitialPremiumEor.uploadedAt": "",
    "uploadInitialPremiumEor.eorNumber": "",
    "uploadInitialPremiumEor.receiptDate": "",
    "uploadInitialPremiumEor.eorFileName": "",
    "uploadInitialPremiumEor.eorFileMimeType": "",
    "uploadInitialPremiumEor.eorFileDataUrl": "",
    "recordCoverageDurationDetails.nextPaymentDate": "",
  };

  if (!dryRun) {
    const [applicationCleanupResult, policyCleanupResult] = await Promise.all([
      Application.collection.updateMany(legacyApplicationCleanupFilter, { $unset: legacyApplicationUnset }),
      Policy.collection.updateMany(legacyPolicyCleanupFilter, { $unset: legacyPolicyUnset }),
    ]);
    summary.cleanedLegacyApplicationFields = Number(applicationCleanupResult.modifiedCount || 0);
    summary.cleanedLegacyPolicyFields = Number(policyCleanupResult.modifiedCount || 0);
  } else {
    const [applicationCleanupCount, policyCleanupCount] = await Promise.all([
      Application.collection.countDocuments(legacyApplicationCleanupFilter),
      Policy.collection.countDocuments(legacyPolicyCleanupFilter),
    ]);
    summary.cleanedLegacyApplicationFields = applicationCleanupCount;
    summary.cleanedLegacyPolicyFields = policyCleanupCount;
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
