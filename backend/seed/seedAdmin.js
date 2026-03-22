/**
 * ==========================================================
 * ONE-TIME ADMIN SEED SCRIPT
 * ==========================================================
 *
 * Purpose:
 * - Creates a standalone administrator account in the Admin collection.
 * - Keeps admin authentication separate from the User role system.
 *
 * Behavior:
 * - Uses MONGO_URI from .env for the MongoDB connection only.
 * - Uses the bootstrap admin credentials defined in this file.
 * - Creates the admin only if the username does not already exist.
 * - Does NOT create or modify any User documents.
 *
 * Required environment variables:
 * - MONGO_URI
 *
 * Usage:
 *   node backend/seed/seedAdmin.js
 * ==========================================================
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Admin = require("../models/Admin");

const SALT_ROUNDS = 10;

/**
 * BOOTSTRAP_ADMIN
 * ---------------
 * Set the one-time admin account you want to create.
 * Change these values manually before running the script.
 */
const BOOTSTRAP_ADMIN = {
  username: "PRUTrackerAdmin",
  password: "bABDIwAJxPFW8s3s",
  firstName: "System",
  lastName: "Administrator",
  email: "",
};

async function seedAdmin() {
  const { MONGO_URI } = process.env;

  if (!MONGO_URI) {
    throw new Error("Missing MONGO_URI in environment (.env).");
  }

  const adminUsername = String(BOOTSTRAP_ADMIN.username || "").trim();
  const adminPassword = String(BOOTSTRAP_ADMIN.password || "");
  const adminFirstName = String(BOOTSTRAP_ADMIN.firstName || "System").trim();
  const adminLastName = String(BOOTSTRAP_ADMIN.lastName || "Administrator").trim();
  const adminEmail = String(BOOTSTRAP_ADMIN.email || "").trim().toLowerCase();

  if (!adminUsername || !adminPassword) {
    throw new Error(
      "Missing BOOTSTRAP_ADMIN.username or BOOTSTRAP_ADMIN.password. Edit backend/seed/seedAdmin.js before running."
    );
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");

  // The bootstrap admin is intentionally one-time only; if the username is
  // already present we exit cleanly instead of mutating that account.
  const existingAdmin = await Admin.findOne({ username: adminUsername }).lean();

  if (existingAdmin) {
    console.log(
      `Admin \"${adminUsername}\" already exists. Seed skipped to preserve the existing account.`
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  // Admin credentials live exclusively in the Admin collection and do not
  // create a parallel User record.
  const admin = await Admin.create({
    username: adminUsername,
    passwordHash,
    firstName: adminFirstName,
    lastName: adminLastName,
    email: adminEmail,
  });

  console.log(`Created admin account: ${admin.username}`);
  console.log("Admin seeding completed");

  await mongoose.disconnect();
  process.exit(0);
}

seedAdmin().catch(async (error) => {
  console.error("Admin seeding error:", error);

  try {
    // Best-effort cleanup so repeated local runs do not leave a hanging
    // database connection after a failed seed attempt.
    await mongoose.disconnect();
  } catch {}

  process.exit(1);
});