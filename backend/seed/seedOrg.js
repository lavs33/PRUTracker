/**
 * ==========================================================
 * TEMPORARY SEED SCRIPT: ORGANIZATIONAL STRUCTURE
 * ==========================================================
 *
 * Purpose:
 * - Seeds hierarchical organization data:
 *      Area → Branch → Unit
 *
 * Structure:
 * - Each Area contains multiple Branches
 * - Each Branch belongs to exactly one Area
 * - Each Unit belongs to exactly one Branch
 *
 * IMPORTANT:
 * - This script DELETES all existing Units, Branches, and Areas.
 * - It should only be used in development.
 *
 * Assumptions:
 * - MongoDB connection string exists in .env
 * - No foreign key constraints prevent deletion
 *
 * Usage:
 *   node seedOrg.js
 * ==========================================================
 */
require("dotenv").config({ path: "../.env" });

const mongoose = require("mongoose");

// Models (hierarchical)
const Area = require("../models/Area");
const Branch = require("../models/Branch");
const Unit = require("../models/Unit");

/**
 * seedOrgStructure()
 *
 * Flow:
 * 1) Connect to MongoDB
 * 2) Delete existing Units → Branches → Areas
 *    (order matters due to references)
 * 3) Loop through static dataset
 * 4) Create Areas
 * 5) Create Branches linked to Area
 * 6) Create Units linked to Branch
 */
async function seedOrgStructure() {
  try {
    console.log("Connecting to MongoDB Atlas...");

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    console.log("Seeding organization structure (loop-based)...");

    /**
     * ⚠ DESTRUCTIVE RESET
     * - Units deleted first (child level)
     * - Branches deleted second
     * - Areas deleted last (root level)
     *
     * Ensures no orphan references remain.
     */
    await Unit.deleteMany({});
    await Branch.deleteMany({});
    await Area.deleteMany({});

    /**
     * Static seed dataset
     * - Defines complete hierarchical structure
     * - Easy to modify for demo purposes
     */
    const areaData = [
      {
        areaName: "Makati",
        branches: [
          {
            branchName: "Diamond Victorian",
            units: ["Alpha Unit", "Bravo Unit", "Charlie Unit"],
          },
        ],
      },
      {
        areaName: "Ortigas Exquadra",
        branches: [
          {
            branchName: "Radiance Quartz",
            units: [
              "Delta Unit",
              "Echo Unit",
              "Foxtrot Unit",
              "Golf Unit",
              "Hotel Unit",
            ],
          },
          {
            branchName: "Carnelian Quartz",
            units: [
              "India Unit",
              "Juliet Unit",
              "Kilo Unit",
              "Lima Unit",
              "Mike Unit",
              "November Unit",
              "Oscar Unit",
            ],
          },
        ],
      },
      {
        areaName: "Quezon City",
        branches: [
          {
            branchName: "Golden Griffin Stone",
            units: [
              "Papa Unit",
              "Quebec Unit",
              "Romeo Unit",
              "Sierra Unit",
            ],
          },
        ],
      },
    ];

    /**
     * Creation Logic
     *
     * For each Area:
     *   - Create Area document
     *   - For each Branch:
     *       - Create Branch with areaId reference
     *       - For each Unit:
     *           - Create Unit with branchId reference
     */
    for (const areaItem of areaData) {
      const area = await Area.create({ areaName: areaItem.areaName });

      for (const branchItem of areaItem.branches) {
        // Each branch stores the parent area reference so admin/manager queries
        // can traverse the organization tree without denormalized strings.
        const branch = await Branch.create({
          branchName: branchItem.branchName,
          areaId: area._id,
        });

        for (const unitName of branchItem.units) {
          // Units are the leaf nodes used for agent assignments.
          await Unit.create({
            unitName,
            branchId: branch._id,
          });
        }
      }
    }

    console.log("Organization seeding completed successfully");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

// Execute seeding
seedOrgStructure();
