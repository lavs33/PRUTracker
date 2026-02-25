/**
 * ==========================================================
 * TEMPORARY SEED SCRIPT: AGENTS
 * ==========================================================
 *
 * Purpose:
 * - Seeds demo Agent users into the database.
 * - Creates both:
 *    1) User documents (role = "AG")
 *    2) Agent documents linked to User
 *
 * IMPORTANT:
 * - This script DELETES all existing Agents.
 * - This script DELETES all Users with role "AG".
 * - DO NOT run in production.
 *
 * Assumptions:
 * - MongoDB connection string is available in .env
 * - Units have already been seeded (Unit collection must not be empty)
 *
 * Usage:
 *   node seedAgents.js
 * ==========================================================
 */
require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");

// Models
const User = require("../models/User");
const Agent = require("../models/Agent");
const Unit = require("../models/Unit");

// Credential utilities
const {
  generateUsername,
  generatePassword,
} = require("../utils/credentials");

/**
 * Helper: calculateAge(birthday)
 *
 * - Computes age based on current date.
 * - Adjusts if birthday has not yet occurred this year.
 * - Used to populate User.age at seed time.
 */
function calculateAge(birthday) {
  const dob = new Date(birthday);
  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();

  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());

  if (!hasHadBirthdayThisYear) age -= 1;

  return age;
}

/**
 * Main seed function
 *
 * Flow:
 * 1) Connect to MongoDB
 * 2) Delete existing Agent + AG Users
 * 3) Fetch available Units
 * 4) Loop through predefined agent data
 * 5) Generate credentials
 * 6) Create User document
 * 7) Create Agent document linked to User
 * 8) Randomly assign a Unit
 */
async function seedAgents() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    /**
     * ⚠ CLEANUP STEP
     * - Removes all existing Agent documents
     * - Removes all Users with role "AG"
     * - This ensures idempotent seeding for development
     */
    await Agent.deleteMany({});
    await User.deleteMany({ role: "AG" });

    // Ensure units exist before assigning agents
    const units = await Unit.find();
    if (units.length === 0) {
      throw new Error("No units found. Seed units first.");
    }

    console.log("Seeding agent users...");

    /**
     * Static seed dataset
     * - Demo agent information
     * - Passwords are generated dynamically
     */
    const agentsData = [
    {
        firstName: "Angel",
        middleName: "Go",
        lastName: "Dela Cruz",
        birthday: "1998-10-12",
        sex: "Female",
        agentType: "Full-Time",
        displayPhoto: "https://i.pravatar.cc/150?img=9",
        dateEmployed: "2018-11-30",
    },
    {
        firstName: "Jericho",
        middleName: "Ramirez",
        lastName: "Dizon",
        birthday: "2000-06-14",
        sex: "Male",
        agentType: "Part-Time",
        displayPhoto: "https://i.pravatar.cc/150?img=11",
        dateEmployed: "2023-05-27",
    },
    {
        firstName: "Carl",
        middleName: "Dela Rosa",
        lastName: "Reyes",
        birthday: "1996-03-08",
        sex: "Male",
        agentType: "Full-Time",
        displayPhoto: "https://i.pravatar.cc/150?img=12",
        dateEmployed: "2017-08-19",
    },
    {
        firstName: "Angela",
        lastName: "Lopez",
        birthday: "1997-09-21",
        sex: "Female",
        agentType: "Part-Time",
        displayPhoto: "https://i.pravatar.cc/150?img=5",
        dateEmployed: "2019-03-10",
    },
    {
        firstName: "Mark",
        middleName: "Lapid",
        lastName: "Villanueva",
        birthday: "1993-01-30",
        sex: "Male",
        agentType: "Full-Time",
        displayPhoto: "https://i.pravatar.cc/150?img=18",
        dateEmployed: "2018-06-06",
    },
    ];

    // Loop through demo dataset
    for (let i = 0; i < agentsData.length; i++) {
      const role = "AG";

      /**
       * Generate deterministic credentials:
       * - Username pattern based on role + index
       * - Password derived from role + birthday + username
       */
      const username = generateUsername(role, i + 1);
      const password = generatePassword(
        role,
        agentsData[i].birthday,
        username
      );

      /**
       * Create User document
       * - Stores personal data
       * - Age is calculated at seed time
       */
      const user = await User.create({
        role,
        username,
        password,
        firstName: agentsData[i].firstName,
        middleName: agentsData[i].middleName || "",
        lastName: agentsData[i].lastName,
        birthday: new Date(agentsData[i].birthday),
        sex: agentsData[i].sex,
        age: calculateAge(agentsData[i].birthday),
        displayPhoto: agentsData[i].displayPhoto,
        dateEmployed: new Date(agentsData[i].dateEmployed),
      });

      /**
       * Random unit assignment
       * - Selects a random Unit from existing units
       */
      const unit = units[Math.floor(Math.random() * units.length)];

      /**
       * Create Agent document
       * - Links to User
       * - Stores agentType and assigned Unit
       */
      await Agent.create({
        userId: user._id,
        agentType: agentsData[i].agentType,
        unitId: unit._id,
      });

      console.log(
        `Created Agent ${username} | Password: ${password}`
      );
    }

    console.log("Agent seeding completed");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
}

// Execute seeding
seedAgents();
