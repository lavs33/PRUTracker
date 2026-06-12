/**
 * Policy Model
 * ------------
 * Stores Policy Issuance-stage records for a single LeadEngagement attempt cycle.
 *
 * The document tracks application-status outcomes, uploaded policy artifacts,
 * and coverage-duration selections used to finalize a converted case.
 */
const mongoose = require("mongoose");

/** Activity enum for the Policy Issuance stage flow. */
const POLICY_ISSUANCE_ACTIVITY = [
  "Upload Initial Premium eOR",
  "Record Policy Application Status",
  "Upload Policy Summary",
  "Record Coverage Duration Details",
];

/**
 * policySchema
 * ------------
 * Persists policy-issuance outputs for one lead engagement attempt cycle.
 */
const policySchema = new mongoose.Schema(
  {
    /** Reference back to the originating LeadEngagement. */
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      index: true,
    },
    /** Engagement attempt cycle this policy-issuance payload belongs to. */
    attemptCycle: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      index: true,
    },
    /** Product reference carried forward into issuance/final policy creation. */
    chosenProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    /** Latest completed policy-issuance subactivity stored on this document. */
    outcomeActivity: {
      type: String,
      enum: POLICY_ISSUANCE_ACTIVITY,
      default: "Upload Initial Premium eOR",
      required: true,
      index: true,
    },
    /** Issued/declined decision plus issuance date and notes. */
    recordPolicyApplicationStatus: {
      status: {
        type: String,
        enum: ["", "Issued", "Declined"],
        default: "",
        trim: true,
      },
      issuanceDate: {
        type: Date,
        default: null,
      },
      declinedDate: {
        type: Date,
        default: null,
      },
      declinationLetterFileName: {
        type: String,
        default: "",
        trim: true,
      },
      declinationLetterFileMimeType: {
        type: String,
        default: "",
        trim: true,
      },
      declinationLetterFileDataUrl: {
        type: String,
        default: "",
      },
      declineReason: {
        type: String,
        default: "",
        trim: true,
      },
      initialPremiumRefundProofFileName: {
        type: String,
        default: "",
        trim: true,
      },
      initialPremiumRefundProofFileMimeType: {
        type: String,
        default: "",
        trim: true,
      },
      initialPremiumRefundProofImageDataUrl: {
        type: String,
        default: "",
      },
      notes: {
        type: String,
        default: "",
        trim: true,
      },
      savedAt: {
        type: Date,
        default: null,
      },
    },
    /** Initial premium receipt/eOR upload details. */
    uploadInitialPremiumEor: {
      paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
        default: null,
      },
    },

    /** Policy summary document metadata and insurer policy number. */
    uploadPolicySummary: {
      policyNumber: {
        type: String,
        default: "",
        trim: true,
        match: /^\d{8}$/,
      },
      policySummaryFileName: {
        type: String,
        default: "",
        trim: true,
      },
      policySummaryFileMimeType: {
        type: String,
        default: "",
        trim: true,
      },
      policySummaryFileDataUrl: {
        type: String,
        default: "",
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
    },
    /** Final coverage duration and payment-term selections. */
    recordCoverageDurationDetails: {
      policyNumber: {
        type: String,
        default: "",
        trim: true,
      },
      selectedPaymentTermLabel: {
        type: String,
        default: "",
        trim: true,
      },
      selectedPaymentTermType: {
        type: String,
        enum: ["", "FIXED_YEARS", "RANGE_TO_AGE", "UNTIL_AGE", "MIXED"],
        default: "",
      },
      selectedPaymentTermYears: {
        type: Number,
        default: null,
      },
      selectedPaymentTermUntilAge: {
        type: Number,
        default: null,
      },
      coverageDurationLabel: {
        type: String,
        default: "",
        trim: true,
      },
      coverageDurationType: {
        type: String,
        enum: ["", "FIXED_YEARS", "RANGE_TO_AGE", "UNTIL_AGE", "MIXED"],
        default: "",
      },
      coverageDurationYears: {
        type: Number,
        default: null,
      },
      coverageDurationUntilAge: {
        type: Number,
        default: null,
      },
      coverageStartDate: {
        type: Date,
        default: null,
      },
      coverageEndDate: {
        type: Date,
        default: null,
      },
      policyEndDate: {
        type: Date,
        default: null,
      },
      savedAt: {
        type: Date,
        default: null,
      },
    },

  },
  { timestamps: true }
);


/** One Policy record is allowed per engagement attempt cycle. */
policySchema.index({ leadEngagementId: 1, attemptCycle: 1 }, { unique: true });

policySchema.index(
  { "uploadPolicySummary.policyNumber": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "uploadPolicySummary.policyNumber": { $type: "string", $ne: "" },
    },
  }
);

module.exports = mongoose.model("Policy", policySchema);