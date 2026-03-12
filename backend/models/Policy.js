const mongoose = require("mongoose");

const POLICY_ISSUANCE_ACTIVITY = [
  "Record Policy Application Status",
  "Upload Initial Premium eOR",
  "Upload Policy Summary",
  "Record Coverage Duration Details",
];

const policySchema = new mongoose.Schema(
  {
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      unique: true,
      index: true,
    },
    chosenProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    outcomeActivity: {
      type: String,
      enum: POLICY_ISSUANCE_ACTIVITY,
      default: "Record Policy Application Status",
      required: true,
      index: true,
    },
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
