/**
 * ==========================================================
 * reset-db.js (TEMPORARY MAINTENANCE SCRIPT)
 * ==========================================================
 *
 * Purpose:
 * - Resets (wipes) core CRM collections for development/testing,
 *   WITHOUT touching User accounts.
 *
 * Collections wiped (ALL documents):
 * - Prospects
 * - Leads
 * - LeadEngagements
 * - Policyholders
 * - ContactAttempts
 *
 * Safety:
 * - Intended to be DRY RUN by default (no deletes).
 * - To actually delete, you should control it via an environment flag.
 *
 * ⚠ NOTE ABOUT CURRENT CODE:
 * - In THIS file, DO_DELETE is hardcoded to true,
 *   which means it WILL DELETE every time you run it.
 * - If you want dry-run default, DO_DELETE should be read from process.env.
 *
 * Usage:
 *   DRY RUN (recommended default):
 *     node reset-db.js
 *
 *   REAL DELETE:
 *     DO_DELETE=true node reset-db.js
 *
 * Requires:
 * - .env containing MONGO_URI
 * ==========================================================
 */
require("dotenv").config();
const mongoose = require("mongoose");

// Models that will be wiped (Users are intentionally excluded)
const Prospect = require("./models/Prospect");
const Lead = require("./models/Lead");
const LeadEngagement = require("./models/LeadEngagement");
const Policyholder = require("./models/Policyholder");
const ContactAttempt = require("./models/ContactAttempt"); 

const MONGO_URI = process.env.MONGO_URI;

/**
 * ⚠ Deletion toggle
 *
 * CURRENT BEHAVIOR:
 * - hardcoded true => always deletes
 *
 * Recommended behavior for safety:
 *   const DO_DELETE = String(process.env.DO_DELETE).toLowerCase() === "true";
 */
const DO_DELETE = true;

/**
 * Helper: pretty console section headers for readability
 */
function header(title) {
  console.log("\n" + "=".repeat(70));
  console.log(title);
  console.log("=".repeat(70));
}

/**
 * Helper: count all target collections
 *
 * Used for:
 * - Pre-check (what will be deleted)
 * - Post-check (confirm deletion worked)
 */
async function countAll() {
  const counts = {
    prospects: await Prospect.countDocuments({}),
    leads: await Lead.countDocuments({}),
    leadEngagements: await LeadEngagement.countDocuments({}),
    policyholders: await Policyholder.countDocuments({}),
    contactAttempts: await ContactAttempt.countDocuments({}),
  };
  return counts;
}

/**
 * Helper: delete all documents in a collection (or dry-run)
 *
 * - If DO_DELETE=false: does NOT delete anything, prints what it would do.
 * - If DO_DELETE=true: deletes all documents with deleteMany({})
 *
 * Returns:
 * - In dry run: { deletedCount: 0, dryRun: true }
 * - In delete mode: MongoDB deleteMany result
 */
async function delAll(Model, label) {
  if (!DO_DELETE) {
    console.log(`(dry-run) would delete ALL ${label}`);
    return { deletedCount: 0, dryRun: true };
  }
  const res = await Model.deleteMany({});
  console.log(`✅ deleted ${res.deletedCount} ${label}`);
  return res;
}

/**
 * Main execution block (IIFE)
 *
 * Flow:
 * 1) Validate environment config
 * 2) Connect to MongoDB
 * 3) Print pre-deletion counts
 * 4) Delete in safe order (children → parents)
 * 5) Print post-deletion counts
 * 6) Disconnect
 */
(async () => {
  header("DB RESET (NO USERS) — DRY RUN by default");

  // Validate MONGO_URI exists
  if (!MONGO_URI) {
    console.error("❌ Missing MONGO_URI in environment (.env).");
    process.exit(1);
  }

  // Print connection + safety summary
  console.log("DB:", MONGO_URI.includes("@") ? "(atlas uri loaded)" : MONGO_URI);
  console.log("DO_DELETE:", DO_DELETE ? "true (WILL DELETE)" : "false (DRY RUN ONLY)");
  console.log("Collections to wipe:", "Prospects, Leads, LeadEngagements, Policyholders, ContactAttempts");
  console.log("Users:", "✅ NOT TOUCHED");

  // Connect
  await mongoose.connect(MONGO_URI);

  // Pre-check counts
  header("Pre-check counts (what would be deleted)");
  const before = await countAll();
  console.log(before);

  header("Delete phase (safe order)");
  /**
   * Delete order matters due to references:
   * - Policyholder depends on Lead (leadId)
   * - ContactAttempt depends on LeadEngagement
   * - LeadEngagement depends on Lead
   * - Lead depends on Prospect
   *
   * Therefore delete children first to avoid leaving orphan references
   * (even though MongoDB won’t block deletes by default).
   */
  await delAll(Policyholder, "Policyholders");
  await delAll(ContactAttempt, "ContactAttempts");
  await delAll(LeadEngagement, "LeadEngagements");
  await delAll(Lead, "Leads");
  await delAll(Prospect, "Prospects");

  // Post-check counts
  header("Post-check counts");
  const after = await countAll();
  console.log(after);

  // Disconnect cleanly
  await mongoose.disconnect();

  header("DONE");
  if (!DO_DELETE) {
    console.log("✅ DRY RUN only. To actually delete, run:");
    console.log("   DO_DELETE=true node reset-db.js");
  }
  process.exit(0);
})().catch(async (err) => {
  console.error("❌ Script failed:", err);
  // Attempt cleanup
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
