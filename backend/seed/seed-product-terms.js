/**
 * Seed Product Payment Terms & Coverage Duration Rules
 * ---------------------------------------------------
 * Writes structured term metadata into existing product documents.
 *
 * NOTE:
 * - Uses raw collection bulkWrite to avoid requiring immediate Product schema changes.
 * - Safe/idempotent: keyed by productName and uses $set.
 *
 * Usage:
 *   node backend/seed/seed-product-terms.js
 */

require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const Product = require("../models/Product");

const MONGO_URI = process.env.MONGO_URI;

/**
 * PRODUCT_TERMS
 * -------------
 * Canonical payment-term and coverage-duration metadata keyed by productName.
 * The script only updates products that already exist in the product catalog.
 */
const PRODUCT_TERMS = [
  {
    productName: "PRULove for Life",
    paymentTermOptions: [{ label: "5 years", type: "FIXED_YEARS", years: 5 }, { label: "10 years", type: "FIXED_YEARS", years: 10 }, { label: "15 years", type: "FIXED_YEARS", years: 15 }, { label: "20 years", type: "FIXED_YEARS", years: 20 }],
    paymentTermLabel: "5, 10, 15, or 20 years",
    coverageDurationRule: { label: "Until age 100", type: "UNTIL_AGE", untilAge: 100 },
    coverageDurationLabel: "Until age 100",
  },
  {
    productName: "PRULifetime Income",
    paymentTermOptions: [{ label: "5 years", type: "FIXED_YEARS", years: 5 }, { label: "10 years", type: "FIXED_YEARS", years: 10 }],
    paymentTermLabel: "5 or 10 years",
    coverageDurationRule: { label: "Until age 100", type: "UNTIL_AGE", untilAge: 100 },
    coverageDurationLabel: "Until age 100",
  },
  {
    productName: "PRUSteady Income",
    paymentTermOptions: [{ label: "5 years", type: "FIXED_YEARS", years: 5 }, { label: "10 years", type: "FIXED_YEARS", years: 10 }],
    paymentTermLabel: "5 or 10 years",
    coverageDurationRule: { label: "20 years", type: "FIXED_YEARS", years: 20 },
    coverageDurationLabel: "20 years",
  },
  {
    productName: "PRUWealth 10",
    paymentTermOptions: [{ label: "1 year", type: "FIXED_YEARS", years: 1 }],
    paymentTermLabel: "1 year",
    coverageDurationRule: { label: "10 years", type: "FIXED_YEARS", years: 10 },
    coverageDurationLabel: "10 years",
  },
  {
    productName: "PRULife Your Term",
    paymentTermOptions: [{ label: "1 year to age 89", type: "RANGE_TO_AGE", minYears: 1, untilAge: 89 }],
    paymentTermLabel: "1 year to age 89",
    coverageDurationRule: { label: "Until age 89", type: "UNTIL_AGE", untilAge: 89 },
    coverageDurationLabel: "Until age 89",
  },
  {
    productName: "PRUTerm 15",
    paymentTermOptions: [{ label: "15 years", type: "FIXED_YEARS", years: 15 }],
    paymentTermLabel: "15 years",
    coverageDurationRule: { label: "15 years", type: "FIXED_YEARS", years: 15 },
    coverageDurationLabel: "15 years",
  },
  {
    productName: "PRUTerm Lindungi",
    paymentTermOptions: [{ label: "1 year to age 59", type: "RANGE_TO_AGE", minYears: 1, untilAge: 59 }],
    paymentTermLabel: "1 year to age 59",
    coverageDurationRule: { label: "Until age 59", type: "UNTIL_AGE", untilAge: 59 },
    coverageDurationLabel: "Until age 59",
  },
  {
    productName: "PRUHealth FamLove",
    paymentTermOptions: [{ label: "1 year to age 85", type: "RANGE_TO_AGE", minYears: 1, untilAge: 85 }],
    paymentTermLabel: "1 year to age 85",
    coverageDurationRule: { label: "Until age 85", type: "UNTIL_AGE", untilAge: 85 },
    coverageDurationLabel: "Until age 85",
  },
  {
    productName: "PRUHealth Prime",
    paymentTermOptions: [{ label: "20 years", type: "FIXED_YEARS", years: 20 }],
    paymentTermLabel: "20 years",
    coverageDurationRule: { label: "Until age 85", type: "UNTIL_AGE", untilAge: 85 },
    coverageDurationLabel: "Until age 85",
  },
  {
    productName: "PRUWellness",
    paymentTermOptions: [{ label: "1 year to age 65", type: "RANGE_TO_AGE", minYears: 1, untilAge: 65 }],
    paymentTermLabel: "1 year to age 65",
    coverageDurationRule: { label: "Until age 65", type: "UNTIL_AGE", untilAge: 65 },
    coverageDurationLabel: "Until age 65",
  },
  {
    productName: "PRU Life Care Advance Plus",
    paymentTermOptions: [{ label: "1 year to age 70", type: "RANGE_TO_AGE", minYears: 1, untilAge: 70 }],
    paymentTermLabel: "1 year to age 70",
    coverageDurationRule: { label: "Until age 70", type: "UNTIL_AGE", untilAge: 70 },
    coverageDurationLabel: "Until age 70",
  },
  {
    productName: "PRU Multiple Life Care Plus",
    paymentTermOptions: [{ label: "1 year to age 70", type: "RANGE_TO_AGE", minYears: 1, untilAge: 70 }],
    paymentTermLabel: "1 year to age 70",
    coverageDurationRule: { label: "Until age 70", type: "UNTIL_AGE", untilAge: 70 },
    coverageDurationLabel: "Until age 70",
  },
  {
    productName: "PRUMillion Protect",
    paymentTermOptions: [{ label: "2 years", type: "FIXED_YEARS", years: 2 }],
    paymentTermLabel: "2 years",
    coverageDurationRule: { label: "Until age 85", type: "UNTIL_AGE", untilAge: 85 },
    coverageDurationLabel: "Until age 85",
  },
  {
    productName: "PRULink Elite Protector Series",
    paymentTermOptions: [{ label: "5 years", type: "FIXED_YEARS", years: 5 }, { label: "7 years", type: "FIXED_YEARS", years: 7 }, { label: "10 years", type: "FIXED_YEARS", years: 10 }, { label: "15 years", type: "FIXED_YEARS", years: 15 }],
    paymentTermLabel: "5, 7, 10, or 15 years",
    coverageDurationRule: { label: "Until age 100", type: "UNTIL_AGE", untilAge: 100 },
    coverageDurationLabel: "Until age 100",
  },
  {
    productName: "PRULink Exact Protector",
    paymentTermOptions: [{ label: "5 years", type: "FIXED_YEARS", years: 5 }, { label: "7 years", type: "FIXED_YEARS", years: 7 }, { label: "10 years", type: "FIXED_YEARS", years: 10 }, { label: "15 years", type: "FIXED_YEARS", years: 15 }],
    paymentTermLabel: "5, 7, 10, or 15 years",
    coverageDurationRule: { label: "Until age 100", type: "UNTIL_AGE", untilAge: 100 },
    coverageDurationLabel: "Until age 100",
  },
  {
    productName: "PRULink Assurance Account Plus",
    paymentTermOptions: [{ label: "Until age 100", type: "UNTIL_AGE", untilAge: 100 }],
    paymentTermLabel: "Until age 100",
    coverageDurationRule: { label: "Until age 100", type: "UNTIL_AGE", untilAge: 100 },
    coverageDurationLabel: "Until age 100",
  },
  {
    productName: "PRUMillionaire",
    paymentTermOptions: [{ label: "1 year", type: "FIXED_YEARS", years: 1 }],
    paymentTermLabel: "1 year",
    coverageDurationRule: { label: "Until age 100", type: "UNTIL_AGE", untilAge: 100 },
    coverageDurationLabel: "Until age 100",
  },
  {
    productName: "PRULink Investor Account Plus",
    paymentTermOptions: [{ label: "1 year", type: "FIXED_YEARS", years: 1 }],
    paymentTermLabel: "1 year",
    coverageDurationRule: { label: "Until age 100", type: "UNTIL_AGE", untilAge: 100 },
    coverageDurationLabel: "Until age 100",
  },
  {
    productName: "PRUMax Invest",
    paymentTermOptions: [{ label: "15 years", type: "FIXED_YEARS", years: 15 }],
    paymentTermLabel: "15 years",
    coverageDurationRule: { label: "15 years", type: "FIXED_YEARS", years: 15 },
    coverageDurationLabel: "15 years",
  },
];



const PRODUCT_REQUIREMENTS = {
  "PRULove for Life": { ageRequirement: { minAge: 18, maxAge: 60, label: "18 - 60" }, minimumSumAssured: { hasStandard: true, amount: 500000, label: "500,000" }, minimumAnnualPremium: { hasStandard: true, amount: 12000, label: "12,000" } },
  "PRULifetime Income": { ageRequirement: { minAge: 18, maxAge: 60, label: "18 - 60" }, minimumSumAssured: { hasStandard: true, amount: 250000, label: "250,000" }, minimumAnnualPremium: { hasStandard: false, amount: null, label: "No standard" } },
  "PRUSteady Income": { ageRequirement: { minAge: 18, maxAge: 60, label: "18 - 60" }, minimumSumAssured: { hasStandard: true, amount: 200000, label: "200,000" }, minimumAnnualPremium: { hasStandard: false, amount: null, label: "No standard" } },
  "PRUWealth 10": { ageRequirement: { minAge: 18, maxAge: 70, label: "18 - 70" }, minimumSumAssured: { hasStandard: true, amount: null, label: "Tiered by age", tiers: [{ minAge: 18, maxAge: 59, amount: 500000, label: "500,000 for ages 18-59" }, { minAge: 60, maxAge: 70, amount: 3000000, label: "3,000,000 for ages 60-70" }] }, minimumAnnualPremium: { hasStandard: false, amount: null, label: "No standard" } },
  "PRULife Your Term": { ageRequirement: { minAge: 18, maxAge: 79, label: "18 - 79" }, minimumSumAssured: { hasStandard: false, amount: null, label: "No standard" }, minimumAnnualPremium: { hasStandard: true, amount: null, label: "Tiered by age", tiers: [{ minAge: 18, maxAge: 39, amount: 8000, label: "8,000 for ages 18-39" }, { minAge: 40, maxAge: 59, amount: 15000, label: "15,000 for ages 40-59" }, { minAge: 60, maxAge: 79, amount: 35000, label: "35,000 for ages 60-79" }] } },
  "PRUTerm 15": { ageRequirement: { minAge: 18, maxAge: 65, label: "18 - 65" }, minimumSumAssured: { hasStandard: false, amount: null, label: "No standard" }, minimumAnnualPremium: { hasStandard: true, amount: 7120, label: "7,120" } },
  "PRUTerm Lindungi": { ageRequirement: { minAge: 18, maxAge: 60, label: "18 - 60" }, minimumSumAssured: { hasStandard: true, amount: 100000, label: "100,000" }, minimumAnnualPremium: { hasStandard: true, amount: null, label: "Tiered by age", tiers: [{ minAge: 18, maxAge: 40, amount: 250, label: "250 for ages 18-40" }, { minAge: 41, maxAge: 49, amount: 550, label: "550 for ages 41-49" }, { minAge: 50, maxAge: 55, amount: 1000, label: "1,000 for ages 50-55" }, { minAge: 56, maxAge: 60, amount: 1400, label: "1,400 for ages 56-60" }] } },
  "PRUHealth FamLove": { ageRequirement: { minAge: 20, maxAge: 60, label: "20 - 60" }, minimumSumAssured: { hasStandard: true, amount: 500000, label: "500,000" }, minimumAnnualPremium: { hasStandard: false, amount: null, label: "No standard" } },
  "PRUHealth Prime": { ageRequirement: { minAge: 18, maxAge: 60, label: "18 - 60" }, minimumSumAssured: { hasStandard: true, amount: 500000, label: "500,000" }, minimumAnnualPremium: { hasStandard: false, amount: null, label: "No standard" } },
  "PRUWellness": { ageRequirement: { minAge: 18, maxAge: 64, label: "18 - 64" }, minimumSumAssured: { hasStandard: true, amount: 500000, label: "500,000" }, minimumAnnualPremium: { hasStandard: true, amount: 2311, label: "2,311" } },
  "PRU Life Care Advance Plus": { ageRequirement: { minAge: 18, maxAge: 65, label: "18 - 65" }, minimumSumAssured: { hasStandard: true, amount: 250000, label: "250,000" }, minimumAnnualPremium: { hasStandard: false, amount: null, label: "No standard" } },
  "PRU Multiple Life Care Plus": { ageRequirement: { minAge: 18, maxAge: 65, label: "18 - 65" }, minimumSumAssured: { hasStandard: true, amount: 250000, label: "250,000" }, minimumAnnualPremium: { hasStandard: false, amount: null, label: "No standard" } },
  "PRUMillion Protect": { ageRequirement: { minAge: 18, maxAge: 70, label: "18 - 70" }, minimumSumAssured: { hasStandard: false, amount: null, label: "No standard" }, minimumAnnualPremium: { hasStandard: true, amount: 250000, label: "250,000" } },
  "PRULink Elite Protector Series": { ageRequirement: { minAge: 18, maxAge: 70, label: "18 - 70" }, minimumSumAssured: { hasStandard: false, amount: null, label: "No standard" }, minimumAnnualPremium: { hasStandard: true, amount: 85000, label: "85,000" } },
  "PRULink Exact Protector": { ageRequirement: { minAge: 18, maxAge: 70, label: "18 - 70" }, minimumSumAssured: { hasStandard: false, amount: null, label: "No standard" }, minimumAnnualPremium: { hasStandard: true, amount: 45000, label: "45,000" } },
  "PRULink Assurance Account Plus": { ageRequirement: { minAge: 18, maxAge: 70, label: "18 - 70" }, minimumSumAssured: { hasStandard: false, amount: null, label: "No standard" }, minimumAnnualPremium: { hasStandard: true, amount: 20000, label: "20,000" } },
  "PRUMillionaire": { ageRequirement: { minAge: 18, maxAge: 70, label: "18 - 70" }, minimumSumAssured: { hasStandard: false, amount: null, label: "No standard" }, minimumAnnualPremium: { hasStandard: true, amount: 1000000, label: "1,000,000" } },
  "PRULink Investor Account Plus": { ageRequirement: { minAge: 18, maxAge: 70, label: "18 - 70" }, minimumSumAssured: { hasStandard: false, amount: null, label: "No standard" }, minimumAnnualPremium: { hasStandard: true, amount: 100000, label: "100,000" } },
  "PRUMax Invest": { ageRequirement: { minAge: 18, maxAge: 65, label: "18 - 65" }, minimumSumAssured: { hasStandard: false, amount: null, label: "No standard" }, minimumAnnualPremium: { hasStandard: true, amount: 7120, label: "7,120" } },
};
(async () => {
  if (!MONGO_URI) {
    console.error("❌ Missing MONGO_URI in environment (.env).");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  // bulkWrite keeps the seed fast and idempotent by matching on productName and
  // only updating the term metadata fields introduced by the workflow change.
  const ops = PRODUCT_TERMS.map((p) => {
    const requirements = PRODUCT_REQUIREMENTS[p.productName] || {};
    return ({
    updateOne: {
      filter: { productName: p.productName },
      update: {
        $set: {
          paymentTermOptions: p.paymentTermOptions,
          paymentTermLabel: p.paymentTermLabel,
          coverageDurationRule: p.coverageDurationRule,
          coverageDurationLabel: p.coverageDurationLabel,
          ageRequirement: requirements.ageRequirement || { minAge: null, maxAge: null, label: "" },
          minimumSumAssured: requirements.minimumSumAssured || { hasStandard: false, amount: null, tiers: [], label: "No standard" },
          minimumAnnualPremium: requirements.minimumAnnualPremium || { hasStandard: false, amount: null, tiers: [], label: "No standard" },
        },
      },
      upsert: false,
    },
  });
  });

  const result = await Product.collection.bulkWrite(ops, { ordered: false });
  console.log("✅ Product payment/coverage term seed complete.");
  console.log({
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("❌ Product payment/coverage term seed failed:", err);
  // Ignore disconnect errors here so the original seed failure stays visible.
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});