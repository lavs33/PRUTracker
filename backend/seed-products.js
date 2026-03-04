/**
 * Seed Products Script
 * --------------------
 * Seeds PRU product catalog with category mapping and blank descriptions.
 *
 * Usage:
 *   node backend/seed-products.js
 *
 * Notes:
 * - Uses upsert on productName so script is safe to re-run.
 * - Keeps description blank ("") for all products by request.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");

const MONGO_URI = process.env.MONGO_URI;

const PRODUCTS = [
  // Protection
  { productName: "PRULove for Life", productCategory: "Protection", description: "" },
  { productName: "PRULifetime Income", productCategory: "Protection", description: "" },
  { productName: "PRUSteady Income", productCategory: "Protection", description: "" },
  { productName: "PRUWealth 10", productCategory: "Protection", description: "" },
  { productName: "PRULife Your Term", productCategory: "Protection", description: "" },
  { productName: "PRUTerm 15", productCategory: "Protection", description: "" },
  { productName: "PRUTerm Lindungi", productCategory: "Protection", description: "" },

  // Health
  { productName: "PRUHealth FamLove", productCategory: "Health", description: "" },
  { productName: "PRUHealth Prime", productCategory: "Health", description: "" },
  { productName: "PRUWellness", productCategory: "Health", description: "" },
  { productName: "PRU Life Care Advance Plus", productCategory: "Health", description: "" },
  { productName: "PRU Multiple Life Care Plus", productCategory: "Health", description: "" },

  // Investment
  { productName: "PRUMillion Protect", productCategory: "Investment", description: "" },
  { productName: "PRULink Elite Protector Series", productCategory: "Investment", description: "" },
  { productName: "PRULink Exact Protector", productCategory: "Investment", description: "" },
  { productName: "PRULink Assurance Account Plus", productCategory: "Investment", description: "" },
  { productName: "PRUMillionaire", productCategory: "Investment", description: "" },
  { productName: "PRULink Investor Account Plus", productCategory: "Investment", description: "" },
  { productName: "PRUMax Invest", productCategory: "Investment", description: "" },

];

(async () => {
  if (!MONGO_URI) {
    console.error("❌ Missing MONGO_URI in environment (.env).");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  const ops = PRODUCTS.map((p) => ({
    updateOne: {
      filter: { productName: p.productName },
      update: {
        $set: {
          productCategory: p.productCategory,
          description: "",
        },
        $setOnInsert: {
          productName: p.productName,
        },
      },
      upsert: true,
    },
  }));

  const result = await Product.bulkWrite(ops, { ordered: false });

  const total = await Product.countDocuments({
    productName: { $in: PRODUCTS.map((p) => p.productName) },
  });

  console.log("✅ Product seed complete.");
  console.log({
    matched: result.matchedCount,
    modified: result.modifiedCount,
    upserted: result.upsertedCount,
    totalSeededProductsPresent: total,
  });

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("❌ Product seed failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
