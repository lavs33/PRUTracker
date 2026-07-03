/**
 * Add the missing next annual payment record for a specific yearly policyholder.
 *
 * Defaults target the known affected record:
 *   policyholder id:   6a45d2b86aea00800422776a
 *   policyholder code: PH-000011
 *
 * Usage from repo root:
 *   DRY_RUN=1 node backend/scripts/add-next-annual-payment-for-policyholder.js
 *   node backend/scripts/add-next-annual-payment-for-policyholder.js --policyholder-code PH-000011
 *   node backend/scripts/add-next-annual-payment-for-policyholder.js --policyholder-id 6a45d2b86aea00800422776a
 *
 * Usage from backend directory:
 *   DRY_RUN=1 node scripts/add-next-annual-payment-for-policyholder.js
 *   node scripts/add-next-annual-payment-for-policyholder.js PH-000011
 */
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Policyholder = require("../models/Policyholder");
const AnnualPayment = require("../models/AnnualPayment");
const Policy = require("../models/Policy");
const LeadEngagement = require("../models/LeadEngagement");
const Lead = require("../models/Lead");
const Prospect = require("../models/Prospect");

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const args = process.argv.slice(2);

function readArg(...names) {
  for (const name of names) {
    const flag = `--${name}`;
    const equalsArg = args.find((arg) => arg.startsWith(`${flag}=`));
    if (equalsArg) return equalsArg.slice(flag.length + 1).trim();
    const index = args.indexOf(flag);
    if (index !== -1) {
      const next = args[index + 1];
      if (!next || next.startsWith("--")) return "true";
      return next.trim();
    }
  }
  return "";
}

function parseBoolean(value) {
  return ["1", "true", "yes", "y"].includes(String(value || "").trim().toLowerCase());
}

function firstNonEmpty(...values) {
  return values.find((value) => String(value || "").trim()) || "";
}

const positional = args.find((arg, index) => {
  if (arg.startsWith("--")) return false;
  const previous = args[index - 1];
  return !previous || !previous.startsWith("--") || previous.includes("=");
}) || "";

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/prutracker";
const DRY_RUN = parseBoolean(firstNonEmpty(readArg("dry-run", "dryRun"), process.env.DRY_RUN));
const FORCE = parseBoolean(firstNonEmpty(readArg("force"), process.env.FORCE));
const POLICYHOLDER_ID = firstNonEmpty(
  readArg("policyholder-id", "policyholderId"),
  process.env.POLICYHOLDER_ID,
  mongoose.isValidObjectId(positional) ? positional : "",
  "6a45d2b86aea00800422776a"
);
const POLICYHOLDER_CODE = firstNonEmpty(
  readArg("policyholder-code", "policyholderCode"),
  process.env.POLICYHOLDER_CODE,
  !mongoose.isValidObjectId(positional) ? positional : "",
  "PH-000011"
);

function nextDay(date) {
  const next = date ? new Date(date) : null;
  if (!next || Number.isNaN(next.getTime())) return null;
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatPeriodDate(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function deriveAnnualPaymentPeriod(start) {
  const startDate = start ? new Date(start) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return { startDate: null, endDate: null, label: "" };
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  endDate.setDate(endDate.getDate() - 1);
  endDate.setHours(0, 0, 0, 0);
  return { startDate, endDate, label: `${formatPeriodDate(startDate)} - ${formatPeriodDate(endDate)}` };
}

function annualPaymentTotalCountForFrequency(frequency) {
  return { Monthly: 12, Quarterly: 4, "Half-yearly": 2, Yearly: 1 }[String(frequency || "").trim()] || 0;
}

function computeAgeAtDate(birthDate, asOfDate) {
  if (!birthDate || !asOfDate || Number.isNaN(birthDate.getTime()) || Number.isNaN(asOfDate.getTime())) return null;
  let age = asOfDate.getFullYear() - birthDate.getFullYear();
  const hadBirthday = asOfDate.getMonth() > birthDate.getMonth()
    || (asOfDate.getMonth() === birthDate.getMonth() && asOfDate.getDate() >= birthDate.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

function derivePaymentTermEndDate(policy = {}, prospect = {}) {
  const coverage = policy?.recordCoverageDurationDetails || {};
  const startDate = coverage.coverageStartDate ? new Date(coverage.coverageStartDate) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return null;

  const type = String(coverage.selectedPaymentTermType || "").trim();
  let years = null;
  if (type === "FIXED_YEARS") {
    years = Number(coverage.selectedPaymentTermYears || 0);
  } else if (["UNTIL_AGE", "RANGE_TO_AGE"].includes(type)) {
    const birthDate = prospect?.birthday ? new Date(prospect.birthday) : null;
    const ageAtStart = computeAgeAtDate(birthDate, startDate);
    years = Number(coverage.selectedPaymentTermUntilAge || 0) - Number(ageAtStart || 0);
  }

  if (!Number.isFinite(years) || years <= 0) return null;
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + years);
  endDate.setHours(0, 0, 0, 0);
  return endDate;
}

async function ensureAnnualPaymentLeadEngagementIndex() {
  const collection = AnnualPayment.collection;
  const indexes = await collection.indexes();
  const legacyUniqueIndex = indexes.find((index) => {
    const key = index?.key || {};
    return index?.unique && key.leadEngagementId === 1 && Object.keys(key).length === 1;
  });
  if (legacyUniqueIndex?.name) {
    console.log(`Dropping legacy unique annual payment index: ${legacyUniqueIndex.name}`);
    if (!DRY_RUN) await collection.dropIndex(legacyUniqueIndex.name);
  }
  const hasPeriodIndex = indexes.some((index) => {
    const key = index?.key || {};
    return index?.unique && key.leadEngagementId === 1 && key["annualPaymentPeriod.startDate"] === 1;
  });
  if (!hasPeriodIndex && !DRY_RUN) {
    await collection.createIndex(
      { leadEngagementId: 1, "annualPaymentPeriod.startDate": 1 },
      { unique: true, sparse: true, name: "leadEngagement_annualPeriodStart_unique" }
    );
  }
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected to MongoDB (${DRY_RUN ? "DRY RUN" : "WRITE"} mode).`);

  const selector = [];
  if (POLICYHOLDER_ID && mongoose.isValidObjectId(POLICYHOLDER_ID)) selector.push({ _id: POLICYHOLDER_ID });
  if (POLICYHOLDER_CODE) selector.push({ policyholderCode: POLICYHOLDER_CODE });
  if (!selector.length) throw new Error("Provide --policyholder-id or --policyholder-code.");

  const policyholder = await Policyholder.findOne({ $or: selector });
  if (!policyholder) throw new Error(`Policyholder not found for id/code: ${POLICYHOLDER_ID || "—"} / ${POLICYHOLDER_CODE || "—"}`);
  if (!policyholder.leadEngagementId) throw new Error("Policyholder is missing leadEngagementId.");

  const annualPaymentIds = (policyholder.annualPaymentRecords || [])
    .map((record) => record?.annualPaymentId)
    .filter(Boolean);
  const annualPayments = await AnnualPayment.find({
    $or: [
      { leadEngagementId: policyholder.leadEngagementId },
      ...(annualPaymentIds.length ? [{ _id: { $in: annualPaymentIds } }] : []),
    ],
  }).sort({ "annualPaymentPeriod.startDate": 1, createdAt: 1 });

  const latestAnnualPayment = [...annualPayments].sort((left, right) => {
    const leftTime = left?.annualPaymentPeriod?.startDate ? new Date(left.annualPaymentPeriod.startDate).getTime() : 0;
    const rightTime = right?.annualPaymentPeriod?.startDate ? new Date(right.annualPaymentPeriod.startDate).getTime() : 0;
    return rightTime - leftTime;
  })[0] || null;
  if (!latestAnnualPayment) throw new Error("No annual payment record found for this policyholder.");
  if (String(latestAnnualPayment.frequencyOfPayment || "") !== "Yearly" && !FORCE) {
    throw new Error(`Latest annual payment frequency is ${latestAnnualPayment.frequencyOfPayment || "—"}; use --force to create anyway.`);
  }

  const nextAnnualStartDate = nextDay(latestAnnualPayment.annualPaymentPeriod?.endDate);
  if (!nextAnnualStartDate) throw new Error("Cannot derive next annual payment period from latest annual payment end date.");
  const nextAnnualPeriod = deriveAnnualPaymentPeriod(nextAnnualStartDate);

  const leadEngagement = await LeadEngagement.findById(policyholder.leadEngagementId).select("leadId contactAttemptCycle").lean();
  const lead = leadEngagement?.leadId ? await Lead.findById(leadEngagement.leadId).select("prospectId").lean() : null;
  const [policy, prospect] = await Promise.all([
    Policy.findOne({ leadEngagementId: policyholder.leadEngagementId }).sort({ attemptCycle: -1, updatedAt: -1, createdAt: -1 }).select("recordCoverageDurationDetails").lean(),
    lead?.prospectId ? Prospect.findById(lead.prospectId).select("birthday").lean() : null,
  ]);
  const paymentTermEndDate = derivePaymentTermEndDate(policy, prospect);
  if (!FORCE && (!paymentTermEndDate || nextAnnualStartDate >= paymentTermEndDate)) {
    throw new Error(`Next annual period ${nextAnnualStartDate.toISOString().slice(0, 10)} is not before the payment term end date ${paymentTermEndDate ? paymentTermEndDate.toISOString().slice(0, 10) : "—"}. Use --force to override.`);
  }

  const totalCount = annualPaymentTotalCountForFrequency(latestAnnualPayment.frequencyOfPayment);
  const newAnnualPayment = {
    leadEngagementId: policyholder.leadEngagementId,
    attemptCycle: latestAnnualPayment.attemptCycle || leadEngagement?.contactAttemptCycle || 1,
    annualPaymentPeriod: nextAnnualPeriod,
    totalAnnualPremiumPhp: latestAnnualPayment.totalAnnualPremiumPhp,
    amountPaidSoFarPhp: 0,
    remainingBalancePhp: latestAnnualPayment.totalAnnualPremiumPhp || 0,
    frequencyOfPayment: latestAnnualPayment.frequencyOfPayment || "Yearly",
    paymentProgress: { paidCount: 0, totalCount, label: `0/${totalCount}` },
    status: "Not Started",
  };

  const existingNextAnnual = await AnnualPayment.findOne({
    leadEngagementId: policyholder.leadEngagementId,
    "annualPaymentPeriod.startDate": nextAnnualPeriod.startDate,
  });

  console.log("Target policyholder:", policyholder.policyholderCode, String(policyholder._id));
  console.log("Latest annual payment:", String(latestAnnualPayment._id), latestAnnualPayment.annualPaymentPeriod?.label, latestAnnualPayment.status);
  console.log("Next annual period:", nextAnnualPeriod.label);
  console.log("Payment term end:", paymentTermEndDate ? paymentTermEndDate.toISOString().slice(0, 10) : "—");

  if (DRY_RUN) {
    console.log(existingNextAnnual ? `Would link existing annual payment ${existingNextAnnual._id}.` : "Would create the next Not Started annual payment record.");
    console.log("Would set policyholder nextPaymentDate to", nextAnnualStartDate.toISOString().slice(0, 10), "and status to Active if currently Paid-Up/At Risk/Lapsed.");
    return;
  }

  await ensureAnnualPaymentLeadEngagementIndex();
  const annualPaymentDoc = existingNextAnnual || await AnnualPayment.create(newAnnualPayment);
  if (existingNextAnnual) {
    existingNextAnnual.set({
      leadEngagementId: newAnnualPayment.leadEngagementId,
      attemptCycle: newAnnualPayment.attemptCycle,
      annualPaymentPeriod: newAnnualPayment.annualPaymentPeriod,
      totalAnnualPremiumPhp: newAnnualPayment.totalAnnualPremiumPhp,
      amountPaidSoFarPhp: 0,
      remainingBalancePhp: newAnnualPayment.remainingBalancePhp,
      frequencyOfPayment: newAnnualPayment.frequencyOfPayment,
      paymentProgress: newAnnualPayment.paymentProgress,
      status: "Not Started",
    });
    await existingNextAnnual.save();
  }

  const hasLink = (policyholder.annualPaymentRecords || []).some((record) => String(record?.annualPaymentId || "") === String(annualPaymentDoc._id));
  if (!hasLink) {
    policyholder.annualPaymentRecords.push({ annualPaymentId: annualPaymentDoc._id, recordedAt: new Date() });
  }
  policyholder.nextPaymentDate = nextAnnualStartDate;
  if (["Paid-Up", "At Risk", "Lapsed"].includes(String(policyholder.status || ""))) {
    policyholder.status = "Active";
  }
  await policyholder.save();

  console.log(`Created/linked next annual payment ${annualPaymentDoc._id} (${nextAnnualPeriod.label}) for ${policyholder.policyholderCode}.`);
}

main()
  .catch((err) => {
    console.error("Error:", err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });