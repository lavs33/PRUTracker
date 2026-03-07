const mongoose = require("mongoose");

const PROPOSAL_ACTIVITY_KEYS = [
  "Generate Proposal",
  "Record Prospect Attendance",
  "Present Proposal",
  "Schedule Application Submission",
];

const proposalSchema = new mongoose.Schema(
  {
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      unique: true,
      index: true,
    },
    currentActivityKey: {
      type: String,
      enum: PROPOSAL_ACTIVITY_KEYS,
      default: "Generate Proposal",
      required: true,
      index: true,
    },
    chosenProduct: {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        default: null,
      },
      productName: {
        type: String,
        default: "",
        trim: true,
      },
      description: {
        type: String,
        default: "",
        trim: true,
      },
    },
    generateProposal: {
      proposalFileName: {
        type: String,
        default: "",
        trim: true,
      },
      proposalFileMimeType: {
        type: String,
        default: "",
        trim: true,
      },
      proposalFileDataUrl: {
        type: String,
        default: "",
      },
      sentToProspectEmail: {
        type: Boolean,
        default: false,
      },
      sentToProspectAt: {
        type: Date,
        default: null,
      },
      generatedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Proposal", proposalSchema);
