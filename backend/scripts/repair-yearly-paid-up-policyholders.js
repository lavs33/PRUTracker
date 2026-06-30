/**
 * Repair yearly policyholders prematurely marked Paid-Up.
 *
 * Usage:
 *   DRY_RUN=1 node backend/scripts/repair-yearly-paid-up-policyholders.js
 *   node backend/scripts/repair-yearly-paid-up-policyholders.js
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
const Notification = require("../models/Notification");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

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
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  endDate.setDate(endDate.getDate() - 1);
  return { startDate, endDate, label: `${formatPeriodDate(startDate)} - ${formatPeriodDate(endDate)}` };
}

function computeAgeAtDate(birthDate, asOfDate) {
  if (!birthDate || !asOfDate || Number.isNaN(birthDate.getTime()) || Number.isNaN(asOfDate.getTime())) return null;
  let age = asOfDate.getFullYear() - birthDate.getFullYear();
  if (asOfDate.getMonth() < birthDate.getMonth() || (asOfDate.getMonth() === birthDate.getMonth() && asOfDate.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

function derivePaymentTermEndDate(policy = {}, prospect = {}) {
  const coverage = policy?.recordCoverageDurationDetails || {};
  const startDate = coverage.coverageStartDate ? new Date(coverage.coverageStartDate) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return null;
  const type = String(coverage.selectedPaymentTermType || "").trim();
  let years = null;
  if (type === "FIXED_YEARS") years = Number(coverage.selectedPaymentTermYears || 0);
  else if (["UNTIL_AGE", "RANGE_TO_AGE"].includes(type)) {
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

function isBeforePaymentTermEnd(date, paymentTermEndDate) {
  return Boolean(date && !Number.isNaN(date.getTime()) && paymentTermEndDate && !Number.isNaN(paymentTermEndDate.getTime()) && date < paymentTermEndDate);
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI || "mongodb://127.0.0.1:27017/prutracker";
  await mongoose.connect(mongoUri);
  const policyholders = await Policyholder.find({ status: "Paid-Up" }).select("assignedToUserId leadEngagementId annualPaymentRecords status nextPaymentDate policyholderCode");
  let repaired = 0;

  for (const policyholder of policyholders) {
    const annualIds = (policyholder.annualPaymentRecords || []).map((r) => r?.annualPaymentId).filter(Boolean);
    const annualPayments = annualIds.length ? await AnnualPayment.find({ _id: { $in: annualIds } }).sort({ "annualPaymentPeriod.startDate": 1, createdAt: 1 }) : [];
    if (!annualPayments.some((ap) => String(ap.frequencyOfPayment || "") === "Yearly")) continue;
    const latestAnnual = annualPayments[annualPayments.length - 1];
    if (!latestAnnual || String(latestAnnual.status || "") !== "Completed") continue;

    const engagement = await LeadEngagement.findById(policyholder.leadEngagementId).select("leadId").lean();
    const lead = engagement?.leadId ? await Lead.findById(engagement.leadId).select("prospectId").lean() : null;
    const prospect = lead?.prospectId ? await Prospect.findById(lead.prospectId).select("birthday").lean() : null;
    const policy = await Policy.findOne({ leadEngagementId: policyholder.leadEngagementId }).sort({ attemptCycle: -1, updatedAt: -1, createdAt: -1 }).select("recordCoverageDurationDetails").lean();
    const paymentTermEndDate = derivePaymentTermEndDate(policy, prospect);
    const nextStart = nextDay(latestAnnual.annualPaymentPeriod?.endDate);
    if (!isBeforePaymentTermEnd(nextStart, paymentTermEndDate)) continue;

    const nextPeriod = deriveAnnualPaymentPeriod(nextStart);
    const existingOpen = await AnnualPayment.findOne({ leadEngagementId: policyholder.leadEngagementId, "annualPaymentPeriod.startDate": nextPeriod.startDate });
    console.log(`${DRY_RUN ? "Would repair" : "Repairing"} ${policyholder.policyholderCode}: next annual period ${nextPeriod.label}`);
    if (!DRY_RUN) {
      let nextAnnual = existingOpen;
      if (!nextAnnual) {
        nextAnnual = await AnnualPayment.create({
          leadEngagementId: policyholder.leadEngagementId,
          attemptCycle: latestAnnual.attemptCycle || 1,
          annualPaymentPeriod: nextPeriod,
          totalAnnualPremiumPhp: latestAnnual.totalAnnualPremiumPhp,
          amountPaidSoFarPhp: 0,
          remainingBalancePhp: latestAnnual.totalAnnualPremiumPhp || 0,
          frequencyOfPayment: "Yearly",
          paymentProgress: { paidCount: 0, totalCount: 1, label: "0/1" },
          status: "Not Started",
        });
      }
      if (!(policyholder.annualPaymentRecords || []).some((r) => String(r?.annualPaymentId || "") === String(nextAnnual._id))) {
        policyholder.annualPaymentRecords.push({ annualPaymentId: nextAnnual._id, recordedAt: new Date() });
      }
      policyholder.status = "Active";
      policyholder.nextPaymentDate = nextStart;
      await policyholder.save();
      await Notification.deleteMany({
        entityType: "Policyholder",
        entityId: policyholder._id,
        type: "POLICY_PAID_UP",
      });
    }
    repaired += 1;
  }

  console.log(`${DRY_RUN ? "Matched" : "Repaired"} ${repaired} policyholder(s).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
