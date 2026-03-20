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
 * - Requires admin credentials from environment variables.
 * - Creates the admin only if the username does not already exist.
 * - Does NOT create or modify any User documents.
 *
 * Required environment variables:
 * - MONGO_URI
 * - ADMIN_USERNAME
 * - ADMIN_PASSWORD
 *
 * Optional environment variables:
 * - ADMIN_FIRST_NAME (default: "System")
 * - ADMIN_LAST_NAME  (default: "Administrator")
 * - ADMIN_EMAIL
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

async function seedAdmin() {
  const {
    MONGO_URI,
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    ADMIN_FIRST_NAME = "System",
    ADMIN_LAST_NAME = "Administrator",
    ADMIN_EMAIL = "",
  } = process.env;

  if (!MONGO_URI) {
    throw new Error("Missing MONGO_URI in environment (.env).");
  }

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    throw new Error(
      "Missing ADMIN_USERNAME or ADMIN_PASSWORD in environment (.env)."
    );
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");

  const existingAdmin = await Admin.findOne({ username: ADMIN_USERNAME }).lean();

  if (existingAdmin) {
    console.log(
      `Admin \"${ADMIN_USERNAME}\" already exists. Seed skipped to preserve the existing account.`
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

  const admin = await Admin.create({
    username: ADMIN_USERNAME,
    passwordHash,
    firstName: ADMIN_FIRST_NAME,
    lastName: ADMIN_LAST_NAME,
    email: ADMIN_EMAIL,
  });

  console.log(`Created admin account: ${admin.username}`);
  console.log("Admin seeding completed");

  await mongoose.disconnect();
  process.exit(0);
}

seedAdmin().catch(async (error) => {
  console.error("Admin seeding error:", error);

  try {
    await mongoose.disconnect();
  } catch {}

  process.exit(1);
});
