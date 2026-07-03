/**
 * Backfill reassigned flags on existing LongLeave affected clients.
 *
 * Usage:
 *   node backend/scripts/backfill-long-leave-reassigned-flags.js
 *
 * The script preserves existing boolean reassigned values and adds
 * `reassigned: false` only when the field is missing or not boolean.
 */
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const LongLeave = require("../models/LongLeave");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

function ensureReassignedFlags(items = []) {
  if (!Array.isArray(items)) return { items: [], changed: false };

  let changed = false;
  const normalizedItems = items.map((item) => {
    const normalizedItem = item && typeof item === "object" ? item : {};
    if (typeof normalizedItem.reassigned === "boolean") return normalizedItem;
    changed = true;
    return { ...normalizedItem, reassigned: false };
  });

  return { items: normalizedItems, changed };
}

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI is required to run the long leave reassigned backfill.");

  await mongoose.connect(mongoUri);

  let scanned = 0;
  let updated = 0;
  const cursor = LongLeave.find({
    $or: [
      { "affectedProspects.reassigned": { $exists: false } },
      { "affectedPolicyholders.reassigned": { $exists: false } },
    ],
  }).cursor();

  for await (const longLeave of cursor) {
    scanned += 1;
    const prospects = ensureReassignedFlags(longLeave.affectedProspects);
    const policyholders = ensureReassignedFlags(longLeave.affectedPolicyholders);
    if (!prospects.changed && !policyholders.changed) continue;

    longLeave.affectedProspects = prospects.items;
    longLeave.affectedPolicyholders = policyholders.items;
    await longLeave.save();
    updated += 1;
  }

  console.log(`Long leave reassigned backfill complete. Scanned ${scanned}, updated ${updated}.`);
}

run()
  .catch((err) => {
    console.error("Long leave reassigned backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
