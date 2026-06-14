/**
 * Backfill Payment payment periods
 * --------------------------------
 * Populates Payment.recordPremiumPaymentTransfer.paymentPeriod from the stored
 * payment date and frequency. The period starts on paymentDate and ends on the
 * day before the next payment due implied by the payment frequency.
 *
 * Usage:
 *   node backend/scripts/backfill-payment-periods.js
 *   DRY_RUN=1 node backend/scripts/backfill-payment-periods.js
 */

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const INTERVAL_MONTHS_BY_FREQUENCY = {
  Monthly: 1,
  Quarterly: 3,
  "Half-yearly": 6,
  Yearly: 12,
};

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

  const intervalMonths = INTERVAL_MONTHS_BY_FREQUENCY[String(frequency || "").trim()] || 0;
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

async function backfillPaymentPeriods() {
  const mongoUri = process.env.MONGO_URI;
  const dryRun = String(process.env.DRY_RUN || "").trim() === "1";

  if (!mongoUri) throw new Error("Missing MONGO_URI in environment (.env).");

  await mongoose.connect(mongoUri);

  const payments = await Payment.find({
    "recordPremiumPaymentTransfer.paymentDate": { $ne: null },
    "recordPremiumPaymentTransfer.frequencyOfPremiumPayment": { $in: Object.keys(INTERVAL_MONTHS_BY_FREQUENCY) },
  })
    .select("recordPremiumPaymentTransfer.paymentDate recordPremiumPaymentTransfer.frequencyOfPremiumPayment recordPremiumPaymentTransfer.paymentPeriod")
    .lean();

  const summary = {
    matchedPayments: payments.length,
    updatedPayments: 0,
    skippedAlreadyCurrent: 0,
    dryRun,
  };

  for (const payment of payments) {
    const transfer = payment.recordPremiumPaymentTransfer || {};
    const paymentPeriod = derivePaymentPeriod(
      transfer.paymentDate,
      transfer.frequencyOfPremiumPayment
    );

    const current = transfer.paymentPeriod || {};
    const currentStart = current.startDate ? new Date(current.startDate).getTime() : null;
    const currentEnd = current.endDate ? new Date(current.endDate).getTime() : null;
    const nextStart = paymentPeriod.startDate ? paymentPeriod.startDate.getTime() : null;
    const nextEnd = paymentPeriod.endDate ? paymentPeriod.endDate.getTime() : null;
    const isAlreadyCurrent = currentStart === nextStart
      && currentEnd === nextEnd
      && String(current.label || "") === String(paymentPeriod.label || "");

    if (isAlreadyCurrent) {
      summary.skippedAlreadyCurrent += 1;
      continue;
    }

    if (!dryRun) {
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { "recordPremiumPaymentTransfer.paymentPeriod": paymentPeriod } }
      );
    }
    summary.updatedPayments += 1;
  }

  console.log("Payment period backfill complete.");
  console.log(summary);
}

backfillPaymentPeriods()
  .catch((err) => {
    console.error("Payment period backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });