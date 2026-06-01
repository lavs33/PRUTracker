/**
 * Payment Model
 * -------------
 * Stores payment-related artifacts for a single LeadEngagement, grouped by the
 * workflow subactivity that captured each part of the payment trail.
 */
const mongoose = require("mongoose");

const PREMIUM_PAYMENT_FREQUENCIES = ["Monthly", "Quarterly", "Half-yearly", "Yearly"];
const PAYMENT_METHODS = [
  "Credit Card / Debit Card",
  "Mobile Wallet / GCash",
  "Dated Check",
  "Bills Payments",
];
const PAYMENT_STATUSES = ["Pending", "Processed"];

const paymentSchema = new mongoose.Schema(
  {
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "Pending",
      index: true,
      trim: true,
    },

    /** Fields captured during Application > Record Premium Payment Transfer. */
    recordPremiumPaymentTransfer: {
      totalPremiumPaidPhp: {
        type: Number,
        default: null,
      },
      frequencyOfPremiumPayment: {
        type: String,
        enum: [...PREMIUM_PAYMENT_FREQUENCIES, ""],
        default: "",
        trim: true,
      },
      paymentDate: {
        type: Date,
        default: null,
      },
      methodForPayment: {
        type: String,
        enum: [...PAYMENT_METHODS, ""],
        default: "",
        trim: true,
      },
      proofOfPaymentFileName: {
        type: String,
        default: "",
        trim: true,
      },
      proofOfPaymentFileMimeType: {
        type: String,
        default: "",
        trim: true,
      },
      proofOfPaymentFileDataUrl: {
        type: String,
        default: "",
      },
      savedAt: {
        type: Date,
        default: null,
      },
    },

    /** Fields captured during Policy Issuance > Upload Premium Payment eOR. */
    uploadPremiumPaymentEor: {
      eorNumber: {
        type: String,
        default: "",
        trim: true,
      },
      receiptDate: {
        type: Date,
        default: null,
      },
      eorFileName: {
        type: String,
        default: "",
        trim: true,
      },
      eorFileMimeType: {
        type: String,
        default: "",
        trim: true,
      },
      eorFileDataUrl: {
        type: String,
        default: "",
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

paymentSchema.index(
  { "uploadPremiumPaymentEor.eorNumber": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "uploadPremiumPaymentEor.eorNumber": { $type: "string", $ne: "" },
    },
  }
);

module.exports = mongoose.model("Payment", paymentSchema);
