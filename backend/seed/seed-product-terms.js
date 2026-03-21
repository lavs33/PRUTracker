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

(async () => {
  if (!MONGO_URI) {
    console.error("❌ Missing MONGO_URI in environment (.env).");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  const ops = PRODUCT_TERMS.map((p) => ({
    updateOne: {
      filter: { productName: p.productName },
      update: {
        $set: {
          paymentTermOptions: p.paymentTermOptions,
          paymentTermLabel: p.paymentTermLabel,
          coverageDurationRule: p.coverageDurationRule,
          coverageDurationLabel: p.coverageDurationLabel,
        },
      },
      upsert: false,
    },
  }));

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
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
