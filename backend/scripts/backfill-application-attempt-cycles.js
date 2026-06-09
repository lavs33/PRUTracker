/**
 * Backfill Application attemptCycle
 * ------------------------------
 * Migrates legacy Application records to the current one-application-per-engagement-
 * cycle shape.
 *
 * Normal leads remain on cycle 1. Reopened leads are inferred from the latest
 * application save date and LeadEngagement reopen boundaries. This prevents a
 * reopened lead's current Application record from staying on attemptCycle=1 and
 * being overwritten by future saves for the same LeadEngagement.
 *
 * Usage:
 *   node backend/scripts/backfill-application-attempt-cycles.js
 *   DRY_RUN=1 node backend/scripts/backfill-application-attempt-cycles.js
 *   FORCE=1 node backend/scripts/backfill-application-attempt-cycles.js
 */

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const LeadEngagement = require("../models/LeadEngagement");
const Application = require("../models/Application");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage:
  node backend/scripts/backfill-application-attempt-cycles.js
  DRY_RUN=1 node backend/scripts/backfill-application-attempt-cycles.js
  FORCE=1 node backend/scripts/backfill-application-attempt-cycles.js

Environment:
  MONGO_URI  MongoDB connection string (required)
  DRY_RUN=1  Report proposed updates without writing
  FORCE=1    Re-scan every Application record instead of only missing/invalid cycles and reopened cycle-1 records`);
  process.exit(0);
}

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

function preferredApplicationCycleDate(application = {}) {
  return latestDate(
    application.updatedAt,
    application.recordApplicationSubmission?.savedAt,
    application.recordPremiumPaymentTransfer?.savedAt,
    application.recordProspectAttendance?.attendedAt,
    application.createdAt
  );
}

async function ensureApplicationCycleIndex() {
  const collection = Application.collection;
  const indexes = await collection.indexes();
  const legacyUniqueIndex = indexes.find((index) => {
    const key = index?.key || {};
    return index?.name === "leadEngagementId_1"
      && index?.unique === true
      && Object.keys(key).length === 1
      && Number(key.leadEngagementId) === 1;
  });
  if (legacyUniqueIndex) await collection.dropIndex("leadEngagementId_1");

  const refreshedIndexes = legacyUniqueIndex ? await collection.indexes() : indexes;
  const hasCompoundIndex = refreshedIndexes.some((index) => {
    const key = index?.key || {};
    return index?.name === "leadEngagementId_1_attemptCycle_1"
      && index?.unique === true
      && Number(key.leadEngagementId) === 1
      && Number(key.attemptCycle) === 1;
  });
  if (!hasCompoundIndex) {
    await collection.createIndex(
      { leadEngagementId: 1, attemptCycle: 1 },
      { name: "leadEngagementId_1_attemptCycle_1", unique: true, background: true }
    );
  }
}

async function backfillApplicationAttemptCycles() {
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
    applicationsScanned: 0,
    applicationsUpdated: 0,
    applicationsAlreadyCorrect: 0,
    applicationsMissingEngagement: 0,
    applicationsSkippedTargetExists: 0,
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

  const applicationCycleBackfillQuery = {
    $or: [{ attemptCycle: { $exists: false } }, { attemptCycle: null }, { attemptCycle: { $lt: 1 } }],
  };
  const reopenedCycleOneQuery = reopenedEngagementIds.length
    ? { leadEngagementId: { $in: reopenedEngagementIds }, attemptCycle: 1 }
    : null;

  const query = force
    ? {}
    : { $or: [applicationCycleBackfillQuery, ...(reopenedCycleOneQuery ? [reopenedCycleOneQuery] : [])] };

  const applications = await Application.find(query)
    .select("leadEngagementId attemptCycle recordApplicationSubmission recordPremiumPaymentTransfer recordProspectAttendance createdAt updatedAt")
    .lean();
  summary.applicationsScanned = applications.length;

  for (const application of applications) {
    const leadEngagementId = application.leadEngagementId;
    const context = engagementContextById.get(String(leadEngagementId || ""));
    if (!context) {
      summary.applicationsMissingEngagement += 1;
      continue;
    }

    const cycle = inferCycleForDate(
      context.ranges,
      preferredApplicationCycleDate(application),
      context.fallbackCycle
    );
    const currentCycle = validCycle(application.attemptCycle);

    if (!force && currentCycle === cycle) {
      summary.applicationsAlreadyCorrect += 1;
      continue;
    }

    const existingTarget = await Application.findOne({
      leadEngagementId,
      attemptCycle: cycle,
      _id: { $ne: application._id },
    }).select("_id").lean();

    if (existingTarget) {
      summary.applicationsSkippedTargetExists += 1;
      continue;
    }

    if (!dryRun) {
      await Application.updateOne({ _id: application._id }, { $set: { attemptCycle: cycle } });
    }
    summary.applicationsUpdated += 1;
  }

  if (!dryRun) await ensureApplicationCycleIndex();

  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

backfillApplicationAttemptCycles().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore disconnect failures during error handling
  }
  process.exit(1);
});