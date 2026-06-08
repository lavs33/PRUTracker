/**
 * Backfill Payment / AnnualPayment attemptCycle
 * ---------------------------------------------
 * Assigns the lead engagement attempt cycle to existing Payment and AnnualPayment
 * records so reopened leads use only the premium payment data captured in their
 * current cycle.
 *
 * The script infers a cycle from each record's saved/created/payment dates and
 * the LeadEngagement.stageHistory reopen timestamps. Cycle 1 also treats legacy
 * missing attemptCycle values as cycle 1 for backwards compatibility.
 *
 * Usage:
 *   node backend/scripts/backfill-payment-attempt-cycles.js
 *   DRY_RUN=1 node backend/scripts/backfill-payment-attempt-cycles.js
 *   FORCE=1 node backend/scripts/backfill-payment-attempt-cycles.js
 */

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const LeadEngagement = require("../models/LeadEngagement");
const Payment = require("../models/Payment");
const AnnualPayment = require("../models/AnnualPayment");


dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function validCycle(value) {
  const cycle = Number(value || 0);
  return Number.isInteger(cycle) && cycle >= 1 ? cycle : null;
}

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateMs(value) {
  const date = asDate(value);
  return date ? date.getTime() : NaN;
}

function earliestDate(...values) {
  return values
    .map(asDate)
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime())[0] || null;
}

function preferredPaymentCycleDate(payment = {}) {
  const transfer = payment.recordPremiumPaymentTransfer || {};
  const eor = payment.uploadPremiumPaymentEor || {};
  return earliestDate(
    transfer.savedAt,
    payment.createdAt,
    transfer.paymentDate,
    eor.uploadedAt,
    eor.receiptDate,
    payment.updatedAt
  );
}

function preferredAnnualPaymentCycleDate(annualPayment = {}) {
  const period = annualPayment.annualPaymentPeriod || {};
  return earliestDate(
    period.startDate,
    annualPayment.createdAt,
    period.endDate,
    annualPayment.updatedAt
  );
}

function buildCycleRanges(engagement = {}) {
  const currentCycle = validCycle(engagement.contactAttemptCycle) || 1;
  const createdAt = asDate(engagement.createdAt) || new Date(0);
  const stageStarts = (Array.isArray(engagement.stageHistory) ? engagement.stageHistory : [])
    .map((entry) => asDate(entry?.startedAt))
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime());
  const firstKnownStart = stageStarts[0] || createdAt;

  const reopenStarts = (Array.isArray(engagement.stageHistory) ? engagement.stageHistory : [])
    .filter((entry) => {
      const reason = String(entry?.reason || "").toLowerCase();
      return reason.includes("re-opened") || reason.includes("reopened");
    })
    .map((entry) => asDate(entry?.startedAt))
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime());

  const ranges = [];
  for (let cycle = 1; cycle <= currentCycle; cycle += 1) {
    const start = cycle === 1 ? firstKnownStart : (reopenStarts[cycle - 2] || null);
    const end = reopenStarts[cycle - 1] || null;
    ranges.push({ cycle, start, end });
  }
  return ranges;
}

function inferCycleForDate(cycleRanges = [], date, fallbackCycle = 1) {
  const timestamp = dateMs(date);
  if (!Number.isFinite(timestamp)) return validCycle(fallbackCycle) || 1;

  const matched = cycleRanges.find((range) => {
    const startMs = Number.isFinite(dateMs(range.start)) ? dateMs(range.start) : -Infinity;
    const endMs = Number.isFinite(dateMs(range.end)) ? dateMs(range.end) : Infinity;
    return timestamp >= startMs && timestamp < endMs;
  });
  return matched?.cycle || validCycle(fallbackCycle) || 1;
}

function needsAttemptCycleBackfill(doc = {}, force = false) {
  if (force) return true;
  const cycle = validCycle(doc.attemptCycle);
  return !cycle;
}

async function backfillPaymentAttemptCycles() {
  const mongoUri = process.env.MONGO_URI;
  const dryRun = String(process.env.DRY_RUN || "").trim() === "1";
  const force = String(process.env.FORCE || "").trim() === "1";

  if (!mongoUri) throw new Error("Missing MONGO_URI in environment (.env).");

  await mongoose.connect(mongoUri);

  const summary = {
    dryRun,
    force,
    engagementsLoaded: 0,
    paymentsScanned: 0,
    paymentsUpdated: 0,
    paymentsAlreadySet: 0,
    paymentsMissingEngagement: 0,
    annualPaymentsScanned: 0,
    annualPaymentsUpdated: 0,
    annualPaymentsAlreadySet: 0,
    annualPaymentsMissingEngagement: 0,
    annualPaymentCycleConflicts: 0,
  };

  const engagements = await LeadEngagement.find({})
    .select("contactAttemptCycle stageHistory createdAt")
    .lean();
  summary.engagementsLoaded = engagements.length;

  const engagementContextById = new Map(
    engagements.map((engagement) => [
      String(engagement._id),
      {
        fallbackCycle: validCycle(engagement.contactAttemptCycle) || 1,
        ranges: buildCycleRanges(engagement),
      },
    ])
  );

  const paymentQuery = force
    ? {}
    : { $or: [{ attemptCycle: { $exists: false } }, { attemptCycle: null }, { attemptCycle: { $lt: 1 } }] };

  const payments = await Payment.find(paymentQuery)
    .select("leadEngagementId annualPaymentId attemptCycle recordPremiumPaymentTransfer uploadPremiumPaymentEor createdAt updatedAt")
    .lean();
  summary.paymentsScanned = payments.length;

  const annualPaymentCycleVotes = new Map();

  for (const payment of payments) {
    const currentCycle = validCycle(payment.attemptCycle);
    if (!needsAttemptCycleBackfill(payment, force)) {
      summary.paymentsAlreadySet += 1;
      if (payment.annualPaymentId && currentCycle) {
        const key = String(payment.annualPaymentId);
        if (!annualPaymentCycleVotes.has(key)) annualPaymentCycleVotes.set(key, new Map());
        const votes = annualPaymentCycleVotes.get(key);
        votes.set(currentCycle, (votes.get(currentCycle) || 0) + 1);
      }
      continue;
    }

    const context = engagementContextById.get(String(payment.leadEngagementId || ""));
    if (!context) {
      summary.paymentsMissingEngagement += 1;
      continue;
    }

    const cycle = inferCycleForDate(context.ranges, preferredPaymentCycleDate(payment), context.fallbackCycle);
    if (!dryRun) {
      await Payment.updateOne({ _id: payment._id }, { $set: { attemptCycle: cycle } });
    }
    summary.paymentsUpdated += 1;

    if (payment.annualPaymentId) {
      const key = String(payment.annualPaymentId);
      if (!annualPaymentCycleVotes.has(key)) annualPaymentCycleVotes.set(key, new Map());
      const votes = annualPaymentCycleVotes.get(key);
      votes.set(cycle, (votes.get(cycle) || 0) + 1);
    }
  }

  // Include already-populated payment votes too, so linked annual payments can be
  // populated correctly even when only AnnualPayment is missing attemptCycle.
  const linkedPayments = await Payment.find({ annualPaymentId: { $ne: null }, attemptCycle: { $gte: 1 } })
    .select("annualPaymentId attemptCycle")
    .lean();
  for (const payment of linkedPayments) {
    const cycle = validCycle(payment.attemptCycle);
    if (!payment.annualPaymentId || !cycle) continue;
    const key = String(payment.annualPaymentId);
    if (!annualPaymentCycleVotes.has(key)) annualPaymentCycleVotes.set(key, new Map());
    const votes = annualPaymentCycleVotes.get(key);
    votes.set(cycle, (votes.get(cycle) || 0) + 1);
  }

  const annualPaymentQuery = force
    ? {}
    : { $or: [{ attemptCycle: { $exists: false } }, { attemptCycle: null }, { attemptCycle: { $lt: 1 } }] };

  const annualPayments = await AnnualPayment.find(annualPaymentQuery)
    .select("leadEngagementId attemptCycle annualPaymentPeriod createdAt updatedAt")
    .lean();
  summary.annualPaymentsScanned = annualPayments.length;

  for (const annualPayment of annualPayments) {
    if (!needsAttemptCycleBackfill(annualPayment, force)) {
      summary.annualPaymentsAlreadySet += 1;
      continue;
    }

    const context = engagementContextById.get(String(annualPayment.leadEngagementId || ""));
    if (!context) {
      summary.annualPaymentsMissingEngagement += 1;
      continue;
    }

    const voteMap = annualPaymentCycleVotes.get(String(annualPayment._id));
    let cycle = null;
    if (voteMap?.size) {
      const sortedVotes = [...voteMap.entries()].sort((left, right) => {
        const countDelta = right[1] - left[1];
        if (countDelta !== 0) return countDelta;
        return right[0] - left[0];
      });
      if (sortedVotes.length > 1) summary.annualPaymentCycleConflicts += 1;
      cycle = sortedVotes[0][0];
    } else {
      cycle = inferCycleForDate(context.ranges, preferredAnnualPaymentCycleDate(annualPayment), context.fallbackCycle);
    }

    if (!dryRun) {
      await AnnualPayment.updateOne({ _id: annualPayment._id }, { $set: { attemptCycle: cycle } });
    }
    summary.annualPaymentsUpdated += 1;
  }

  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

backfillPaymentAttemptCycles().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore disconnect failures during error handling
  }
  process.exit(1);
});
