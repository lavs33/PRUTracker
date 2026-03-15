/**
 * ==========================================================
 * delete-accident-products.js (ONE-TIME CLEANUP)
 * ==========================================================
 *
 * Purpose:
 * - Deletes Product docs where productCategory = "Accident".
 * - Optionally remaps Policyholders referencing those products.
 *
 * Safety:
 * - DRY RUN by default.
 * - Real update/delete only when DO_DELETE=true
 *
 * Optional remap:
 * - Set REPLACEMENT_PRODUCT_ID to a valid Product _id.
 * - If provided and DO_DELETE=true, policyholders using accident products
 *   are reassigned to REPLACEMENT_PRODUCT_ID before deletion.
 *
 * Usage:
 *   Dry run only:
 *     node backend/delete-accident-products.js
 *
 *   Real delete (no remap; blocked if references exist):
 *     DO_DELETE=true node backend/delete-accident-products.js
 *
 *   Real delete with remap:
 *     DO_DELETE=true REPLACEMENT_PRODUCT_ID=<productId> node backend/delete-accident-products.js
 * ==========================================================
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");
const Policyholder = require("./models/Policyholder");

const MONGO_URI = process.env.MONGO_URI;
const DO_DELETE = String(process.env.DO_DELETE).toLowerCase() === "true";
const REPLACEMENT_PRODUCT_ID = String(process.env.REPLACEMENT_PRODUCT_ID || "").trim();

function header(title) {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

(async () => {
  if (!MONGO_URI) {
    console.error("❌ Missing MONGO_URI in environment (.env).");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  header("ACCIDENT PRODUCT CLEANUP");
  console.log("DO_DELETE:", DO_DELETE ? "true (WILL UPDATE/DELETE)" : "false (DRY RUN ONLY)");
  console.log("REPLACEMENT_PRODUCT_ID:", REPLACEMENT_PRODUCT_ID || "(not provided)");

  const accidentProducts = await Product.find(
    { productCategory: "Accident" },
    { _id: 1, productName: 1, productCategory: 1 }
  ).lean();
  const accidentIds = accidentProducts.map((p) => p._id);

  header("Found Accident Products");
  console.log({ count: accidentProducts.length, products: accidentProducts });

  if (!accidentProducts.length) {
    console.log("✅ No accident products found. Nothing to do.");
    await mongoose.disconnect();
    process.exit(0);
  }

  const referencingCount = await Policyholder.countDocuments({ productId: { $in: accidentIds } });
  const referencingPreview = await Policyholder.find(
    { productId: { $in: accidentIds } },
    { _id: 1, policyholderCode: 1, productId: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  header("Policyholder References");
  console.log({ referencingCount, preview: referencingPreview });

  if (!DO_DELETE) {
    console.log("(dry-run) no writes performed.");
    await mongoose.disconnect();
    process.exit(0);
  }

  if (referencingCount > 0 && !REPLACEMENT_PRODUCT_ID) {
    console.error(
      "❌ Cannot delete: there are policyholders pointing to accident products. " +
        "Provide REPLACEMENT_PRODUCT_ID to remap first."
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (referencingCount > 0) {
        if (!mongoose.isValidObjectId(REPLACEMENT_PRODUCT_ID)) {
          throw Object.assign(new Error("REPLACEMENT_PRODUCT_ID is not a valid ObjectId."), { status: 400 });
        }

        const replacement = await Product.findById(REPLACEMENT_PRODUCT_ID).session(session);
        if (!replacement) {
          throw Object.assign(new Error("Replacement product not found."), { status: 404 });
        }

        if (String(replacement.productCategory) === "Accident") {
          throw Object.assign(new Error("Replacement product cannot be an Accident category product."), { status: 400 });
        }

        const remapRes = await Policyholder.updateMany(
          { productId: { $in: accidentIds } },
          { $set: { productId: replacement._id } },
          { session }
        );
        console.log(`✅ Remapped ${remapRes.modifiedCount} policyholders -> ${replacement.productName}`);
      }

      const deleteRes = await Product.deleteMany({ _id: { $in: accidentIds } }, { session });
      console.log(`✅ Deleted ${deleteRes.deletedCount} accident products.`);
    });
  } catch (err) {
    console.error("❌ Cleanup failed:", err.message || err);
    throw err;
  } finally {
    session.endSession();
  }

  await mongoose.disconnect();
  console.log("✅ DONE");
  process.exit(0);
})().catch(async () => {
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
