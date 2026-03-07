const mongoose = require("mongoose");

const PROPOSAL_ACTIVITY = [
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
    // Store latest completed Proposal activity (activity flow source remains LeadEngagement.currentActivityKey)
    outcomeActivity: {
      type: String,
      enum: PROPOSAL_ACTIVITY,
      default: "Generate Proposal",
      required: true,
      index: true,
    },
    chosenProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
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
