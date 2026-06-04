/**
 * Backfill AnnualPayment records
 * ------------------------------
 * Creates AnnualPayment documents from existing Application/Payment data,
 * links Payment.annualPaymentId, migrates Policyholder.paymentRecords to
 * Policyholder.annualPaymentRecords, and removes Application-owned annual
 * premium/frequency fields that now belong to AnnualPayment.
 *
 * Usage:
 *   node backend/scripts/backfill-annual-payment-records.js
 *   DRY_RUN=1 node backend/scripts/backfill-annual-payment-records.js
 */

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Application = require("../models/Application");
const Payment = require("../models/Payment");
const Policyholder = require("../models/Policyholder");
const AnnualPayment = require("../models/AnnualPayment");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const FREQUENCY_COUNTS = {
  Monthly: 12,
  Quarterly: 4,
  "Half-yearly": 2,
  Yearly: 1,
};

function formatPeriodDate(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function deriveAnnualPaymentPeriod(paymentDate) {
  const startDate = paymentDate ? new Date(paymentDate) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) {
    return { startDate: null, endDate: null, label: "" };
  }

  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  endDate.setDate(endDate.getDate() - 1);

  return {
    startDate,
    endDate,
    label: `${formatPeriodDate(startDate)} - ${formatPeriodDate(endDate)}`,
  };
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

function buildMetrics({ totalAnnualPremiumPhp, amountPaidSoFarPhp, paidCount, frequencyOfPayment }) {
  const totalAnnual = Number(totalAnnualPremiumPhp || 0);
  const amountPaid = Number(amountPaidSoFarPhp || 0);
  const normalizedTotal = Number.isFinite(totalAnnual) && totalAnnual > 0 ? Math.round(totalAnnual * 100) / 100 : 0;
  const normalizedPaid = Number.isFinite(amountPaid) && amountPaid > 0 ? Math.round(amountPaid * 100) / 100 : 0;
  const remainingBalancePhp = Math.max(0, Math.round((normalizedTotal - normalizedPaid) * 100) / 100);
  const totalCount = FREQUENCY_COUNTS[String(frequencyOfPayment || "").trim()] || 0;
  const normalizedPaidCount = Math.max(0, Number(paidCount || 0));
  const status = normalizedPaidCount <= 0 && normalizedPaid <= 0
    ? "Not Started"
    : (normalizedTotal > 0 && normalizedPaid >= normalizedTotal && totalCount > 0 && normalizedPaidCount >= totalCount ? "Completed" : "Ongoing");

  return {
    amountPaidSoFarPhp: normalizedPaid,
    remainingBalancePhp,
    paymentProgress: {
      paidCount: normalizedPaidCount,
      totalCount,
      label: `${normalizedPaidCount}/${totalCount}`,
    },
    status,
  };
}

async function backfillAnnualPaymentRecords() {
  const mongoUri = process.env.MONGO_URI;
  const dryRun = String(process.env.DRY_RUN || "").trim() === "1";

  if (!mongoUri) throw new Error("Missing MONGO_URI in environment (.env).");

  await mongoose.connect(mongoUri);

  const summary = {
    matchedPayments: 0,
    upsertedAnnualPayments: 0,
    linkedPayments: 0,
    migratedPolicyholders: 0,
    cleanedApplications: 0,
    dryRun,
  };

  const payments = await Payment.find({})
    .select("leadEngagementId annualPaymentId recordPremiumPaymentTransfer")
    .lean();
  const meaningfulPayments = payments.filter(hasMeaningfulPaymentTransferData);
  summary.matchedPayments = meaningfulPayments.length;

  const annualPaymentIdsByPaymentId = new Map();
  const annualPaymentIdsByEngagementId = new Map();

  for (const payment of meaningfulPayments) {
    const engagementId = payment.leadEngagementId;
    if (!engagementId) continue;

    const application = await Application.collection.findOne(
      { leadEngagementId: new mongoose.Types.ObjectId(String(engagementId)) },
      { projection: { recordPremiumPaymentTransfer: 1 } }
    );
    const transfer = payment.recordPremiumPaymentTransfer || {};
    const legacyApplicationTransfer = application?.recordPremiumPaymentTransfer || {};
    const frequencyOfPayment = String(
      legacyApplicationTransfer.frequencyOfPremiumPayment
      || transfer.frequencyOfPremiumPayment
      || ""
    ).trim();
    const paidAmount = Number(transfer.totalPremiumPaidPhp || 0);
    const expectedCount = FREQUENCY_COUNTS[frequencyOfPayment] || 0;
    const inferredAnnual = expectedCount > 0 ? Math.round(paidAmount * expectedCount * 100) / 100 : null;
    const totalAnnualPremiumPhp = legacyApplicationTransfer.totalAnnualPremiumPhp !== undefined && legacyApplicationTransfer.totalAnnualPremiumPhp !== null
      ? Number(legacyApplicationTransfer.totalAnnualPremiumPhp)
      : inferredAnnual;
    const paymentDate = transfer.paymentDate || transfer.savedAt || null;
    const annualPaymentPeriod = deriveAnnualPaymentPeriod(paymentDate);
    const paidCount = paidAmount > 0 ? 1 : 0;
    const metrics = buildMetrics({
      totalAnnualPremiumPhp,
      amountPaidSoFarPhp: paidAmount,
      paidCount,
      frequencyOfPayment,
    });

    let annualPaymentId = payment.annualPaymentId || null;
    if (!dryRun) {
      const annualPayment = await AnnualPayment.findOneAndUpdate(
        { leadEngagementId: engagementId },
        {
          $setOnInsert: { leadEngagementId: engagementId },
          $set: {
            annualPaymentPeriod,
            totalAnnualPremiumPhp,
            frequencyOfPayment,
            ...metrics,
          },
        },
        { upsert: true, new: true }
      );
      annualPaymentId = annualPayment._id;
      summary.upsertedAnnualPayments += 1;

      const paymentUpdate = await Payment.updateOne(
        { _id: payment._id },
        { $set: { annualPaymentId } }
      );
      summary.linkedPayments += Number(paymentUpdate.modifiedCount || 0);
    } else {
      annualPaymentId = annualPaymentId || new mongoose.Types.ObjectId();
      summary.upsertedAnnualPayments += 1;
      summary.linkedPayments += payment.annualPaymentId ? 0 : 1;
    }

    if (annualPaymentId) {
      annualPaymentIdsByPaymentId.set(String(payment._id), annualPaymentId);
      annualPaymentIdsByEngagementId.set(String(engagementId), annualPaymentId);
    }
  }

  const policyholders = await Policyholder.collection.find({
    $or: [
      { "paymentRecords.paymentId": { $exists: true } },
      { annualPaymentRecords: { $exists: false } },
    ],
  }).toArray();

  for (const policyholder of policyholders) {
    const annualPaymentRecords = [];
    const seenAnnualPaymentIds = new Set();

    for (const record of policyholder.paymentRecords || []) {
      const paymentId = record?.paymentId ? String(record.paymentId) : "";
      const annualPaymentId = annualPaymentIdsByPaymentId.get(paymentId);
      if (!annualPaymentId || seenAnnualPaymentIds.has(String(annualPaymentId))) continue;
      seenAnnualPaymentIds.add(String(annualPaymentId));
      annualPaymentRecords.push({ annualPaymentId, recordedAt: record.recordedAt || new Date() });
    }

    const engagementAnnualPaymentId = annualPaymentIdsByEngagementId.get(String(policyholder.leadEngagementId || ""));
    if (engagementAnnualPaymentId && !seenAnnualPaymentIds.has(String(engagementAnnualPaymentId))) {
      annualPaymentRecords.push({ annualPaymentId: engagementAnnualPaymentId, recordedAt: new Date() });
    }

    if (!dryRun) {
      const update = { $unset: { paymentRecords: "" } };
      if (annualPaymentRecords.length) update.$set = { annualPaymentRecords };
      const result = await Policyholder.collection.updateOne({ _id: policyholder._id }, update);
      summary.migratedPolicyholders += Number(result.modifiedCount || 0);
    } else if (annualPaymentRecords.length || Array.isArray(policyholder.paymentRecords)) {
      summary.migratedPolicyholders += 1;
    }
  }

  const applicationCleanupFilter = {
    $or: [
      { "recordPremiumPaymentTransfer.frequencyOfPremiumPayment": { $exists: true } },
      { "recordPremiumPaymentTransfer.totalAnnualPremiumPhp": { $exists: true } },
    ],
  };
  const applicationCleanupUnset = {
    "recordPremiumPaymentTransfer.frequencyOfPremiumPayment": "",
    "recordPremiumPaymentTransfer.totalAnnualPremiumPhp": "",
  };
  if (!dryRun) {
    const cleanupResult = await Application.collection.updateMany(applicationCleanupFilter, { $unset: applicationCleanupUnset });
    summary.cleanedApplications = Number(cleanupResult.modifiedCount || 0);
  } else {
    summary.cleanedApplications = await Application.collection.countDocuments(applicationCleanupFilter);
  }

  console.log("Annual payment backfill complete.");
  console.log(summary);
}

backfillAnnualPaymentRecords()
  .catch((err) => {
    console.error("Annual payment backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
