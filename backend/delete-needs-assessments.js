/**
 * delete-needs-assessments.js
 * ---------------------------
 * One-time utility script to delete all existing NeedsAssessment documents.
 *
 * Usage:
 *   node backend/delete-needs-assessments.js
 *
 * Requirements:
 *   - .env file with MONGO_URI
 */
require("dotenv").config();

const mongoose = require("mongoose");
const NeedsAssessment = require("./models/NeedsAssessment");

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  if (!MONGO_URI) {
    console.error("❌ Missing MONGO_URI in environment (.env).");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connected.");

    const beforeCount = await NeedsAssessment.countDocuments({});
    console.log(`Found ${beforeCount} needs assessment document(s).`);

    if (beforeCount === 0) {
      console.log("Nothing to delete.");
      return;
    }

    const result = await NeedsAssessment.deleteMany({});
    console.log(`🗑️  Deleted ${result.deletedCount || 0} needs assessment document(s).`);
  } catch (err) {
    console.error("❌ Failed to delete needs assessments:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB disconnected.");
  }
}

run();