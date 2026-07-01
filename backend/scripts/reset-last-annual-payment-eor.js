/*
 * Reset the latest processed payment eOR on a policyholder's annual payment record for retesting.
 * Usage examples:
 *   DRY_RUN=1 POLICYHOLDER_CODE=PH-000007 node backend/scripts/reset-last-annual-payment-eor.js
 *   POLICYHOLDER_ID=<id> ANNUAL_PAYMENT_ID=<id> node backend/scripts/reset-last-annual-payment-eor.js
 *   POLICYHOLDER_CODE=PH-000007 PAYMENT_ID=<id> node backend/scripts/reset-last-annual-payment-eor.js
 */
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/prutracker";
const DRY_RUN = ["1", "true", "yes"].includes(String(process.env.DRY_RUN || "").toLowerCase());
const POLICYHOLDER_ID = process.env.POLICYHOLDER_ID || "";
const POLICYHOLDER_CODE = process.env.POLICYHOLDER_CODE || "";
const ANNUAL_PAYMENT_ID = process.env.ANNUAL_PAYMENT_ID || "";
const PAYMENT_ID = process.env.PAYMENT_ID || "";

const policyholderSchema = new mongoose.Schema({}, { strict: false, collection: "policyholders", timestamps: true });
const annualPaymentSchema = new mongoose.Schema({}, { strict: false, collection: "annualpayments", timestamps: true });
const paymentSchema = new mongoose.Schema({}, { strict: false, collection: "payments", timestamps: true });

const Policyholder = mongoose.model("PolicyholderResetEor", policyholderSchema);
const AnnualPayment = mongoose.model("AnnualPaymentResetEor", annualPaymentSchema);
const Payment = mongoose.model("PaymentResetEor", paymentSchema);

function validObjectId(value) {
  return value && mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;
}

async function main() {
  if (!POLICYHOLDER_ID && !POLICYHOLDER_CODE) {
    throw new Error("Provide POLICYHOLDER_ID or POLICYHOLDER_CODE.");
  }

  await mongoose.connect(MONGO_URI);

  const policyholderFilter = POLICYHOLDER_ID
    ? { _id: validObjectId(POLICYHOLDER_ID) }
    : { policyholderCode: POLICYHOLDER_CODE };
  const policyholder = await Policyholder.findOne(policyholderFilter);
  if (!policyholder) throw new Error("Policyholder not found.");

  const annualPaymentFilter = ANNUAL_PAYMENT_ID
    ? { _id: validObjectId(ANNUAL_PAYMENT_ID), leadEngagementId: policyholder.leadEngagementId }
    : { leadEngagementId: policyholder.leadEngagementId };
  const annualPayment = await AnnualPayment.findOne(annualPaymentFilter)
    .sort({ "annualPaymentPeriod.startDate": -1, createdAt: -1 });
  if (!annualPayment) throw new Error("Annual payment record not found.");

  const paymentFilter = PAYMENT_ID
    ? { _id: validObjectId(PAYMENT_ID), annualPaymentId: annualPayment._id }
    : {
        annualPaymentId: annualPayment._id,
        $or: [
          { status: "Processed" },
          { "uploadPremiumPaymentEor.eorNumber": { $nin: [null, ""] } },
          { "uploadPremiumPaymentEor.receiptDate": { $ne: null } },
          { "uploadPremiumPaymentEor.eorFileDataUrl": { $nin: [null, ""] } },
        ],
      };
  const payment = await Payment.findOne(paymentFilter).sort({ "recordPremiumPaymentTransfer.paymentDate": -1, updatedAt: -1, createdAt: -1 });
  if (!payment) throw new Error("Processed/eOR payment record not found for reset.");

  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Resetting eOR for policyholder ${policyholder.policyholderCode || policyholder._id}, annual payment ${annualPayment._id}, payment ${payment._id}`);

  if (!DRY_RUN) {
    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: { status: "Pending" },
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

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
