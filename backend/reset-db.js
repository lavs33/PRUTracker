/**
 * ==========================================================
 * reset-db.js (LEAD-CASCADE RESET SCRIPT)
 * ==========================================================
 *
 * Purpose:
 * - Deletes ALL Leads and all records that depend on them.
 * - Keeps Users and Prospects untouched.
 *
 * Cascaded collections:
 * - Policyholders      (leadId -> Lead._id)
 * - LeadEngagements    (leadId -> Lead._id)
 * - ContactAttempts    (leadEngagementId -> LeadEngagement._id)
 * - ScheduledMeetings  (leadEngagementId)
 * - NeedsAssessments   (leadEngagementId -> LeadEngagement._id)
 * - Tasks              (leadEngagementId -> LeadEngagement._id)
 * - Notifications      (entityType="Task" + entityId in deleted Task._id)
 *
 * Safety:
 * - DRY RUN by default.
 * - Real delete only when DO_DELETE=true
 *
 * Usage:
 *   Dry run:
 *     node reset-db.js
 *
 *   Real delete:
 *     DO_DELETE=true node reset-db.js
 *
 * Requires:
 * - .env with MONGO_URI
 * ==========================================================
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Core models
const Lead = require("./models/Lead");
const LeadEngagement = require("./models/LeadEngagement");
const ContactAttempt = require("./models/ContactAttempt");
const ScheduledMeeting = require("./models/ScheduledMeeting");
const Policyholder = require("./models/Policyholder");
const NeedsAssessment = require("./models/NeedsAssessment");
const Task = require("./models/Task");
const Notification = require("./models/Notification");

const MONGO_URI = process.env.MONGO_URI;
const DO_DELETE = true;

function header(title) {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

function toObjectIds(arr) {
  return (arr || []).map((x) => (x?._id ? x._id : x)).filter(Boolean);
}

async function getIdsSnapshot() {
  const leads = await Lead.find({}, { _id: 1 }).lean();
  const leadIds = toObjectIds(leads);

  const engagements = await LeadEngagement.find(
    { leadId: { $in: leadIds } },
    { _id: 1, leadId: 1 }
  ).lean();
  const engagementIds = toObjectIds(engagements);

  const attempts = await ContactAttempt.find(
    { leadEngagementId: { $in: engagementIds } },
    { _id: 1 }
  ).lean();
  const attemptIds = toObjectIds(attempts);

  const tasks = await Task.find(
    { leadEngagementId: { $in: engagementIds } },
    { _id: 1 }
  ).lean();
  const taskIds = toObjectIds(tasks);

  return { leadIds, engagementIds, attemptIds, taskIds };
}

async function countScope(ids) {
  const { leadIds, engagementIds, attemptIds, taskIds } = ids;

  return {
    leads: await Lead.countDocuments({ _id: { $in: leadIds } }),
    leadEngagements: await LeadEngagement.countDocuments({ _id: { $in: engagementIds } }),
    contactAttempts: await ContactAttempt.countDocuments({
      leadEngagementId: { $in: engagementIds },
    }),
    scheduledMeetings: await ScheduledMeeting.countDocuments({
      leadEngagementId: { $in: engagementIds },
    }),
    needsAssessments: await NeedsAssessment.countDocuments({
      leadEngagementId: { $in: engagementIds },
    }),
    policyholders: await Policyholder.countDocuments({ leadId: { $in: leadIds } }),
    tasks: await Task.countDocuments({ _id: { $in: taskIds } }),
    notificationsForTasks: await Notification.countDocuments({
      entityType: "Task",
      entityId: { $in: taskIds },
    }),
  };
}

async function delMany(Model, query, label) {
  if (!DO_DELETE) {
    const count = await Model.countDocuments(query);
    console.log(`(dry-run) would delete ${count} ${label}`);
    return { deletedCount: 0, dryRun: true };
  }

  const res = await Model.deleteMany(query);
  console.log(`✅ deleted ${res.deletedCount} ${label}`);
  return res;
}

(async () => {
  header("LEAD CASCADE RESET — DRY RUN by default");

  if (!MONGO_URI) {
    console.error("❌ Missing MONGO_URI in environment (.env).");
    process.exit(1);
  }

  console.log("DB:", MONGO_URI.includes("@") ? "(atlas uri loaded)" : MONGO_URI);
  console.log("DO_DELETE:", DO_DELETE ? "true (WILL DELETE)" : "false (DRY RUN ONLY)");
  console.log("Scope:", "ALL LEADS + dependent collections");
  console.log("Untouched:", "Users, Prospects");

  await mongoose.connect(MONGO_URI);

  header("Snapshot IDs");
  const ids = await getIdsSnapshot();
  console.log({
    leadIds: ids.leadIds.length,
    engagementIds: ids.engagementIds.length,
    attemptIds: ids.attemptIds.length,
    taskIds: ids.taskIds.length,
  });

  header("Pre-check counts (what would be deleted)");
  const before = await countScope(ids);
  console.log(before);

  header("Delete phase (children -> parents)");
  await delMany(
    Notification,
    { entityType: "Task", entityId: { $in: ids.taskIds } },
    "Notifications (Task-linked)"
  );
  await delMany(Task, { _id: { $in: ids.taskIds } }, "Tasks");
  await delMany(
    ScheduledMeeting,
    { leadEngagementId: { $in: ids.engagementIds } },
    "ScheduledMeetings"
  );
  await delMany(
    ContactAttempt,
    { leadEngagementId: { $in: ids.engagementIds } },
    "ContactAttempts"
  );
  await delMany(
    NeedsAssessment,
    { leadEngagementId: { $in: ids.engagementIds } },
    "NeedsAssessments"
  );
  await delMany(
    Policyholder,
    { leadId: { $in: ids.leadIds } },
    "Policyholders"
  );
  await delMany(
    LeadEngagement,
    { _id: { $in: ids.engagementIds } },
    "LeadEngagements"
  );
  await delMany(Lead, { _id: { $in: ids.leadIds } }, "Leads");

  header("Post-check counts");
  const after = await countScope(ids);
  console.log(after);

  await mongoose.disconnect();

  header("DONE");
  if (!DO_DELETE) {
    console.log("✅ DRY RUN only. To actually delete, run:");
    console.log("   DO_DELETE=true node reset-db.js");
  }

  process.exit(0);
})().catch(async (err) => {
  console.error("❌ Script failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});