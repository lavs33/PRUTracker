/**
 * Backfill NeedsAssessment attemptCycle
 * ------------------------------------
 * Assigns the lead engagement attempt cycle to existing NeedsAssessment records.
 *
 * Normal leads remain on cycle 1. Reopened leads are inferred from the saved
 * needs-assessment dates and the LeadEngagement reopen boundaries, so stale
 * pre-drop needs assessment data remains tied to its old cycle while needs
 * assessment data saved after reopening is tied to the current cycle.
 *
 * Usage:
 *   node backend/scripts/backfill-needs-assessment-attempt-cycles.js
 *   DRY_RUN=1 node backend/scripts/backfill-needs-assessment-attempt-cycles.js
 *   FORCE=1 node backend/scripts/backfill-needs-assessment-attempt-cycles.js
 */

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const LeadEngagement = require("../models/LeadEngagement");
const NeedsAssessment = require("../models/NeedsAssessment");

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

function latestDate(...values) {
  return values
    .map(asDate)
    .filter(Boolean)
    .sort((left, right) => right.getTime() - left.getTime())[0] || null;
}

function uniqueSortedDates(dates = []) {
  const seen = new Set();
  return dates
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime())
    .filter((date) => {
      const key = String(date.getTime());
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildCycleRanges(engagement = {}) {
  const currentCycle = validCycle(engagement.contactAttemptCycle) || 1;
  const createdAt = asDate(engagement.createdAt) || new Date(0);
  const stageStarts = uniqueSortedDates(
    (Array.isArray(engagement.stageHistory) ? engagement.stageHistory : [])
      .map((entry) => asDate(entry?.startedAt))
  );
  const firstKnownStart = stageStarts[0] || createdAt;

  const stageHistoryReopenStarts = (Array.isArray(engagement.stageHistory) ? engagement.stageHistory : [])
    .filter((entry) => {
      const reason = String(entry?.reason || "").toLowerCase();
      return reason.includes("re-opened") || reason.includes("reopened");
    })
    .map((entry) => asDate(entry?.startedAt));

  const stageStartedAt = asDate(engagement.stageStartedAt);
  const reopenStarts = uniqueSortedDates([
    ...stageHistoryReopenStarts,
    ...(currentCycle > 1 && stageStartedAt ? [stageStartedAt] : []),
  ]).slice(0, Math.max(0, currentCycle - 1));

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

function preferredNeedsAssessmentCycleDate(needsAssessment = {}) {
  // Avoid using updatedAt as the primary signal because backfill/migration
  // updates can modify it. These business timestamps are enough to separate
  // normal vs reopened cycles for saved and blank needs-assessment documents.
  return latestDate(
    needsAssessment.followUpNeedsAssessmentDecidedAt,
    needsAssessment.attendedAt,
    needsAssessment.createdAt
  );
}

async function backfillNeedsAssessmentAttemptCycles() {
  const mongoUri = process.env.MONGO_URI;
  const dryRun = String(process.env.DRY_RUN || "").trim() === "1";
  const force = String(process.env.FORCE || "").trim() === "1";

  if (!mongoUri) throw new Error("Missing MONGO_URI in environment (.env).");

  await mongoose.connect(mongoUri);

  const summary = {
    dryRun,
    force,
    engagementsLoaded: 0,
    reopenedEngagementsLoaded: 0,
    needsAssessmentsScanned: 0,
    needsAssessmentsUpdated: 0,
    needsAssessmentsAlreadyCorrect: 0,
    needsAssessmentsMissingEngagement: 0,
  };

  const engagements = await LeadEngagement.find({})
    .select("contactAttemptCycle stageHistory stageStartedAt createdAt")
    .lean();
  summary.engagementsLoaded = engagements.length;

  const reopenedEngagementIds = engagements
    .filter((engagement) => (validCycle(engagement.contactAttemptCycle) || 1) > 1)
    .map((engagement) => engagement._id);
  summary.reopenedEngagementsLoaded = reopenedEngagementIds.length;

  const engagementContextById = new Map(
    engagements.map((engagement) => [
      String(engagement._id),
      {
        fallbackCycle: validCycle(engagement.contactAttemptCycle) || 1,
        ranges: buildCycleRanges(engagement),
      },
    ])
  );

  const needsCycleBackfillQuery = {
    $or: [{ attemptCycle: { $exists: false } }, { attemptCycle: null }, { attemptCycle: { $lt: 1 } }],
  };
  const reopenedCycleOneQuery = reopenedEngagementIds.length
    ? { leadEngagementId: { $in: reopenedEngagementIds }, attemptCycle: 1 }
    : null;

  const query = force
    ? {}
    : { $or: [needsCycleBackfillQuery, ...(reopenedCycleOneQuery ? [reopenedCycleOneQuery] : [])] };

  const needsAssessments = await NeedsAssessment.find(query)
    .select("leadEngagementId attemptCycle attendedAt followUpNeedsAssessmentDecidedAt createdAt")
    .lean();
  summary.needsAssessmentsScanned = needsAssessments.length;

  for (const needsAssessment of needsAssessments) {
    const context = engagementContextById.get(String(needsAssessment.leadEngagementId || ""));
    if (!context) {
      summary.needsAssessmentsMissingEngagement += 1;
      continue;
    }

    const cycle = inferCycleForDate(
      context.ranges,
      preferredNeedsAssessmentCycleDate(needsAssessment),
      context.fallbackCycle
    );
    const currentCycle = validCycle(needsAssessment.attemptCycle);

    if (!force && currentCycle === cycle) {
      summary.needsAssessmentsAlreadyCorrect += 1;
    } else {
      if (!dryRun) {
        await NeedsAssessment.updateOne({ _id: needsAssessment._id }, { $set: { attemptCycle: cycle } });
      }
      summary.needsAssessmentsUpdated += 1;
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

backfillNeedsAssessmentAttemptCycles().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore disconnect failures during error handling
  }
  process.exit(1);
});
