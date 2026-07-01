/*
 * Reset the latest payment eOR on a policyholder's latest annual payment record for retesting.
 *
 * Usage examples from the repo root:
 *   DRY_RUN=1 node backend/scripts/reset-last-annual-payment-eor.js --policyholder-id 6a4399fbe296ecb9d212afe9
 *   node backend/scripts/reset-last-annual-payment-eor.js --policyholder-code PH-000007
 *
 * Usage examples from the backend directory:
 *   DRY_RUN=1 node scripts/reset-last-annual-payment-eor.js --policyholder-id 6a4399fbe296ecb9d212afe9
 *   node scripts/reset-last-annual-payment-eor.js PH-000007
 *
 * Optional selectors:
 *   --annual-payment-id <id>  Reset within a specific annual payment record.
 *   --payment-id <id>         Reset a specific payment record within the selected annual payment.
 *   --dry-run                 Preview matches without writing changes.
 */
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Support running from either the repo root or backend directory.
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

function firstNonEmpty(...values) {
  return values.find((value) => String(value || "").trim()) || "";
}

function parseBoolean(value) {
  return ["1", "true", "yes", "y"].includes(String(value || "").toLowerCase());
}

const positional = args.filter((arg, index) => {
  if (arg.startsWith("--")) return false;
  const previous = args[index - 1];
  return !previous || !previous.startsWith("--") || previous.includes("=");
});
const positionalPolicyholder = positional[0] || "";

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/prutracker";
const DRY_RUN = parseBoolean(firstNonEmpty(readArg("dry-run", "dryRun"), process.env.DRY_RUN));
const POLICYHOLDER_ID = firstNonEmpty(
  readArg("policyholder-id", "policyholderId"),
  process.env.POLICYHOLDER_ID,
  mongoose.isValidObjectId(positionalPolicyholder) ? positionalPolicyholder : ""
);
const POLICYHOLDER_CODE = firstNonEmpty(
  readArg("policyholder-code", "policyholderCode"),
  process.env.POLICYHOLDER_CODE,
  !mongoose.isValidObjectId(positionalPolicyholder) ? positionalPolicyholder : ""
);
const ANNUAL_PAYMENT_ID = firstNonEmpty(readArg("annual-payment-id", "annualPaymentId"), process.env.ANNUAL_PAYMENT_ID);
const PAYMENT_ID = firstNonEmpty(readArg("payment-id", "paymentId"), process.env.PAYMENT_ID);

const policyholderSchema = new mongoose.Schema({}, { strict: false, collection: "policyholders", timestamps: true });
const annualPaymentSchema = new mongoose.Schema({}, { strict: false, collection: "annualpayments", timestamps: true });
const paymentSchema = new mongoose.Schema({}, { strict: false, collection: "payments", timestamps: true });

const Policyholder = mongoose.model("PolicyholderResetEor", policyholderSchema);
const AnnualPayment = mongoose.model("AnnualPaymentResetEor", annualPaymentSchema);
const Payment = mongoose.model("PaymentResetEor", paymentSchema);

function requiredObjectId(value, label) {
  if (!value) return null;
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`${label} is not a valid ObjectId: ${value}`);
  }
  return new mongoose.Types.ObjectId(value);
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

async function main() {
  if (!POLICYHOLDER_ID && !POLICYHOLDER_CODE) {
    throw new Error(
      "Provide --policyholder-id, --policyholder-code, POLICYHOLDER_ID, or POLICYHOLDER_CODE. Example: node backend/scripts/reset-last-annual-payment-eor.js --policyholder-id 6a4399fbe296ecb9d212afe9"
    );
  }

  await mongoose.connect(MONGO_URI);

  const policyholderFilter = POLICYHOLDER_ID
    ? { _id: requiredObjectId(POLICYHOLDER_ID, "Policyholder ID") }
    : { policyholderCode: POLICYHOLDER_CODE };
  const policyholder = await Policyholder.findOne(policyholderFilter);
  if (!policyholder) throw new Error("Policyholder not found.");
  if (!policyholder.leadEngagementId) throw new Error("Policyholder has no leadEngagementId, so annual payments cannot be matched.");

  const annualPaymentFilter = ANNUAL_PAYMENT_ID
    ? { _id: requiredObjectId(ANNUAL_PAYMENT_ID, "Annual payment ID"), leadEngagementId: policyholder.leadEngagementId }
    : { leadEngagementId: policyholder.leadEngagementId };
  const annualPayments = await AnnualPayment.find(annualPaymentFilter).sort({
    "annualPaymentPeriod.startDate": -1,
    "annualPaymentPeriod.endDate": -1,
    updatedAt: -1,
    createdAt: -1,
  });
  if (!annualPayments.length) throw new Error("Annual payment record not found.");

  async function findLatestPaymentForAnnual(annualPaymentRecord) {
    const paymentObjectId = requiredObjectId(PAYMENT_ID, "Payment ID");
    const directFilter = PAYMENT_ID
      ? { _id: paymentObjectId, annualPaymentId: annualPaymentRecord._id }
      : { annualPaymentId: annualPaymentRecord._id };
    const directPayment = await Payment.findOne(directFilter).sort({
      "recordPremiumPaymentTransfer.paymentDate": -1,
      updatedAt: -1,
      createdAt: -1,
    });
    if (directPayment) return directPayment;

    const periodStart = annualPaymentRecord.annualPaymentPeriod?.startDate ? new Date(annualPaymentRecord.annualPaymentPeriod.startDate) : null;
    const periodEnd = annualPaymentRecord.annualPaymentPeriod?.endDate ? new Date(annualPaymentRecord.annualPaymentPeriod.endDate) : null;
    const hasPeriodBounds = periodStart && periodEnd && !Number.isNaN(periodStart.getTime()) && !Number.isNaN(periodEnd.getTime());
    const fallbackFilter = {
      ...(PAYMENT_ID ? { _id: paymentObjectId } : {}),
      leadEngagementId: policyholder.leadEngagementId,
      ...(hasPeriodBounds
        ? {
            "recordPremiumPaymentTransfer.paymentDate": {
              $gte: periodStart,
              $lte: periodEnd,
            },
          }
        : {}),
    };

    return Payment.findOne(fallbackFilter).sort({
      "recordPremiumPaymentTransfer.paymentDate": -1,
      updatedAt: -1,
      createdAt: -1,
    });
  }

  let annualPayment = null;
  let payment = null;
  for (const candidateAnnualPayment of annualPayments) {
    const candidatePayment = await findLatestPaymentForAnnual(candidateAnnualPayment);
    if (candidatePayment) {
      annualPayment = candidateAnnualPayment;
      payment = candidatePayment;
      break;
    }
    if (ANNUAL_PAYMENT_ID) break;
  }
  if (!annualPayment || !payment) {
    throw new Error(
      ANNUAL_PAYMENT_ID
        ? "Payment record not found in the selected annual payment record."
        : "Payment record not found in any annual payment record for this policyholder. Check whether the policyholder has payment records linked to this lead engagement."
    );
  }

  const eor = payment.uploadPremiumPaymentEor || {};
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Matched policyholder: ${policyholder.policyholderCode || policyholder._id}`);
  console.log(`Latest annual payment: ${annualPayment._id} (${formatDate(annualPayment.annualPaymentPeriod?.startDate)} - ${formatDate(annualPayment.annualPaymentPeriod?.endDate)}), current status: ${annualPayment.status || "N/A"}`);
  console.log(`Latest payment: ${payment._id}, current status: ${payment.status || "N/A"}, payment date: ${formatDate(payment.recordPremiumPaymentTransfer?.paymentDate)}`);
  console.log(`eOR number to clear: ${eor.eorNumber || "N/A"}; receipt date: ${formatDate(eor.receiptDate)}`);

  if (!DRY_RUN) {
    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: {
          status: "Pending",
          annualPaymentId: annualPayment._id,
        },
        $unset: { uploadPremiumPaymentEor: "" },
      }
    );
    await AnnualPayment.updateOne(
      { _id: annualPayment._id },
      { $set: { status: "Ongoing" } }
    );
    await Policyholder.updateOne(
      { _id: policyholder._id },
      { $set: { status: "Active", nextPaymentDate: null } }
    );
  }

  console.log(`${DRY_RUN ? "Preview complete" : "Reset complete"}: payment is linked to the selected annual payment and set to Pending, latest annual payment is Ongoing, and policyholder is Active with no next payment date.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });