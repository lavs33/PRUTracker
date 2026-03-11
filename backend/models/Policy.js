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
      coverageStartDate: {
        type: Date,
        default: null,
      },
      coverageEndDate: {
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

module.exports = mongoose.model("Policy", policySchema);
