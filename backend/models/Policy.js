/**
 * Policy Model
 * ------------
 * Stores Policy Issuance-stage records for a single LeadEngagement.
 *
 * The document tracks application-status outcomes, uploaded policy artifacts,
 * and coverage-duration selections used to finalize a converted case.
 */
const mongoose = require("mongoose");

/** Activity enum for the Policy Issuance stage flow. */
const POLICY_ISSUANCE_ACTIVITY = [
  "Record Policy Application Status",
  "Upload Initial Premium eOR",
  "Upload Policy Summary",
  "Record Coverage Duration Details",
];

/**
 * policySchema
 * ------------
 * Persists policy-issuance outputs for one lead engagement.
 */
const policySchema = new mongoose.Schema(
  {
    /** One-to-one reference back to the originating LeadEngagement. */
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      unique: true,
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
      default: "Record Policy Application Status",
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
      nextPaymentDate: {
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


policySchema.index(
  { "uploadInitialPremiumEor.eorNumber": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "uploadInitialPremiumEor.eorNumber": { $type: "string", $ne: "" },
    },
  }
);


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