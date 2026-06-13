/**
 * Backfill Policy Cancelled notifications
 * ---------------------------------------
 * Creates POLICY_CANCELLED notifications for existing Cancelled policyholders
 * that do not already have a cancellation notification dedupe key.
 *
 * Usage:
 *   node backend/scripts/backfill-policy-cancelled-notifications.js
 *   DRY_RUN=1 node backend/scripts/backfill-policy-cancelled-notifications.js
 *   POLICYHOLDER_ID=<id> node backend/scripts/backfill-policy-cancelled-notifications.js
 */

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Policyholder = require("../models/Policyholder");
const Notification = require("../models/Notification");
const Product = require("../models/Product");
const LeadEngagement = require("../models/LeadEngagement");
const Lead = require("../models/Lead");
const Prospect = require("../models/Prospect");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function toValidObjectId(value) {
  const id = String(value || "").trim();
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

function fullName(prospect) {
  return `${prospect?.firstName || ""}${prospect?.middleName ? ` ${prospect.middleName}` : ""} ${prospect?.lastName || ""}`.trim();
}

async function backfillPolicyCancelledNotifications() {
  const mongoUri = process.env.MONGO_URI;
  const dryRun = String(process.env.DRY_RUN || "").trim() === "1";
  const policyholderObjectId = toValidObjectId(process.env.POLICYHOLDER_ID);

  if (!mongoUri) throw new Error("Missing MONGO_URI in environment (.env).");
  if (process.env.POLICYHOLDER_ID && !policyholderObjectId) {
    throw new Error("POLICYHOLDER_ID must be a valid ObjectId when provided.");
  }

  await mongoose.connect(mongoUri);

  const policyholderQuery = {
    status: "Cancelled",
    ...(policyholderObjectId ? { _id: policyholderObjectId } : {}),
  };

  const policyholders = await Policyholder.find(policyholderQuery)
    .select("assignedToUserId policyholderCode policyNumber productId leadEngagementId status")
    .sort({ policyholderCode: 1, createdAt: 1 })
    .lean();

  const summary = {
    matchedCancelledPolicyholders: policyholders.length,
    createdNotifications: 0,
    skippedExistingNotification: 0,
    skippedMissingAssignedUser: 0,
    dryRun,
  };

  if (!policyholders.length) {
    console.log("Policy cancelled notification backfill complete.");
    console.log(summary);
    return;
  }

  const dedupeKeys = policyholders.map((policyholder) => `POLICY_CANCELLED:${policyholder._id}`);
  const existingNotifications = await Notification.find({ dedupeKey: { $in: dedupeKeys } })
    .select("dedupeKey")
    .lean();
  const existingDedupeKeys = new Set(existingNotifications.map((notification) => String(notification.dedupeKey || "")));

  const productIds = [...new Set(policyholders.map((policyholder) => String(policyholder.productId || "")).filter(Boolean))]
    .filter((id) => mongoose.isValidObjectId(id));
  const leadEngagementIds = [...new Set(policyholders.map((policyholder) => String(policyholder.leadEngagementId || "")).filter(Boolean))]
    .filter((id) => mongoose.isValidObjectId(id));

  const [products, leadEngagements] = await Promise.all([
    productIds.length ? Product.find({ _id: { $in: productIds } }).select("productName").lean() : [],
    leadEngagementIds.length ? LeadEngagement.find({ _id: { $in: leadEngagementIds } }).select("leadId").lean() : [],
  ]);

  const productNameById = new Map(products.map((product) => [String(product._id), product.productName || "—"]));
  const leadIdByEngagementId = new Map(
    leadEngagements.map((engagement) => [String(engagement._id), String(engagement.leadId || "")])
  );
  const leadIds = [...new Set([...leadIdByEngagementId.values()].filter((id) => mongoose.isValidObjectId(id)))];
  const leads = leadIds.length ? await Lead.find({ _id: { $in: leadIds } }).select("prospectId").lean() : [];
  const prospectIdByLeadId = new Map(leads.map((lead) => [String(lead._id), String(lead.prospectId || "")]));
  const prospectIds = [...new Set([...prospectIdByLeadId.values()].filter((id) => mongoose.isValidObjectId(id)))];
  const prospects = prospectIds.length
    ? await Prospect.find({ _id: { $in: prospectIds } }).select("firstName middleName lastName").lean()
    : [];
  const prospectById = new Map(prospects.map((prospect) => [String(prospect._id), prospect]));

  const writes = [];
  for (const policyholder of policyholders) {
    const dedupeKey = `POLICY_CANCELLED:${policyholder._id}`;
    if (existingDedupeKeys.has(dedupeKey)) {
      summary.skippedExistingNotification += 1;
      continue;
    }
    if (!policyholder.assignedToUserId) {
      summary.skippedMissingAssignedUser += 1;
      continue;
    }

    const leadId = leadIdByEngagementId.get(String(policyholder.leadEngagementId || "")) || "";
    const prospectId = prospectIdByLeadId.get(leadId) || "";
    const prospect = prospectById.get(prospectId) || null;
    const policyholderName = fullName(prospect) || "—";
    const policyName = productNameById.get(String(policyholder.productId || "")) || "—";
    const policyholderCode = policyholder.policyholderCode || "—";
    const policyNumber = policyholder.policyNumber || "—";
    const message = `Policy cancelled. Policyholder Code: ${policyholderCode}. Policyholder Name: ${policyholderName}. Policy Name: ${policyName}. Policy Number: ${policyNumber}.`;

    writes.push({
      updateOne: {
        filter: { assignedToUserId: policyholder.assignedToUserId, dedupeKey },
        update: {
          $set: {
            type: "POLICY_CANCELLED",
            title: "Policy cancelled",
            message,
            entityType: "Policyholder",
            entityId: policyholder._id,
            metadata: {
              policyholderId: String(policyholder._id),
              policyholderCode,
              policyholderName,
              policyName,
              policyNumber,
              nextStatus: "Cancelled",
              backfilled: true,
            },
            softDeletedAt: null,
            softDeleteReason: "",
            softDeletedByUserId: null,
          },
          $setOnInsert: {
            assignedToUserId: policyholder.assignedToUserId,
            dedupeKey,
            status: "Unread",
            readAt: null,
          },
        },
        upsert: true,
      },
    });
    summary.createdNotifications += 1;
  }

  if (!dryRun && writes.length) {
    await Notification.bulkWrite(writes, { ordered: false });
  }

  console.log("Policy cancelled notification backfill complete.");
  console.log(summary);
}

backfillPolicyCancelledNotifications()
  .catch((err) => {
    console.error("Policy cancelled notification backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
