
/**
 * Application Model
 * -----------------
 * Captures the Application-stage artifacts for a single LeadEngagement.
 *
 * The detailed stage pointer still lives on LeadEngagement.currentActivityKey;
 * this document stores the saved data produced by each application subactivity.
 */
const mongoose = require("mongoose");

/**
 * Enumerations
 * ------------
 * Shared enums used by application-stage validation.
 */
const APPLICATION_ACTIVITY = [
  "Record Prospect Attendance",
  "Record Premium Payment Transfer",
  "Record Application Submission",
];

const RENEWAL_PAYMENT_METHODS = [
  "Credit Card / Debit Card",
  "Mobile Wallet / GCash",
  "Dated Check",
  "Bills Payments",
];

const PREMIUM_PAYMENT_FREQUENCIES = ["Monthly", "Quarterly", "Half-yearly", "Yearly"];

/**
 * applicationSchema
 * -----------------
 * Stores the persisted payload for each application-stage sub-step.
 */
const applicationSchema = new mongoose.Schema(
  {
    /**
     * leadEngagementId
     * ----------------
     * One-to-one link back to the engagement this Application record belongs to.
     */
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      unique: true,
      index: true,
    },

    /** Latest completed application subactivity for display/reporting. */
    outcomeActivity: {
      type: String,
      enum: APPLICATION_ACTIVITY,
      default: "Record Prospect Attendance",
      required: true,
      index: true,
    },

    /** Chosen product snapshot reference carried into the application stage. */
    chosenProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    /** Prospect attendance evidence for the application meeting. */
    recordProspectAttendance: {
      attended: {
        type: Boolean,
        default: false,
      },
      attendedAt: {
        type: Date,
        default: null,
      },
      attendanceProofImageDataUrl: {
        type: String,
        default: "",
      },
      attendanceProofFileName: {
        type: String,
        default: "",
        trim: true,
      },
    },

    /** Premium transfer details captured before formal submission. */
    recordPremiumPaymentTransfer: {
      paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
        default: null,
      },
      frequencyOfPremiumPayment: {
        type: String,
        enum: [...PREMIUM_PAYMENT_FREQUENCIES, ""],
        default: "",
        trim: true,
      },
      totalAnnualPremiumPhp: {
        type: Number,
        default: null,
      },
      methodForRenewalPayment: {
        type: String,
        enum: [...RENEWAL_PAYMENT_METHODS, ""],
        default: "",
        trim: true,
      },
    },

    /** Final application submission proof captured from PRUOnePH flow. */
    recordApplicationSubmission: {
      pruOneTransactionId: {
        type: String,
        default: "",
        trim: true,
      },
      submissionScreenshotImageDataUrl: {
        type: String,
        default: "",
      },
      submissionScreenshotFileName: {
        type: String,
        default: "",
        trim: true,
      },
      savedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

/**
 * Unique PRUOne transaction IDs
 * -----------------------------
 * Empty-string values are ignored via partialFilterExpression so unsaved rows do
 * not violate the uniqueness constraint.
 */
applicationSchema.index(
  { "recordApplicationSubmission.pruOneTransactionId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "recordApplicationSubmission.pruOneTransactionId": { $type: "string", $ne: "" },
    },
  }
);

module.exports = mongoose.model("Application", applicationSchema);
