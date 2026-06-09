/**
 * Proposal Model
 * --------------
 * Stores saved Proposal-stage outputs for a single LeadEngagement.
 *
 * Similar to Application/Policy, this document is the persistence container for
 * stage artifacts, while LeadEngagement.currentActivityKey remains the source of
 * truth for the current active step.
 */
const mongoose = require("mongoose");

/** Proposal-stage activity enum used by outcomeActivity. */
const PROPOSAL_ACTIVITY = [
  "Generate Proposal",
  "Record Prospect Attendance",
  "Present Proposal",
  "Schedule Application Submission",
];

/**
 * proposalSchema
 * --------------
 * Persists proposal presentation files, attendance proof, and presentation
 * outcome details for a given lead engagement.
 */
const proposalSchema = new mongoose.Schema(
  {
    /** Relationship back to the owning LeadEngagement. */
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      index: true,
    },

    /** Engagement attempt cycle this proposal payload belongs to. */
    attemptCycle: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      index: true,
    },

    /** Latest completed proposal subactivity saved in this document. */
    outcomeActivity: {
      type: String,
      enum: PROPOSAL_ACTIVITY,
      default: "Generate Proposal",
      required: true,
      index: true,
    },

    /** Product selected for the proposal being presented to the prospect. */
    chosenProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    /** Attendance proof for the proposal presentation session. */
    recordProspectAttendance: {
      attendanceChoice: {
        type: String,
        enum: ["", "YES", "NO"],
        default: "",
      },
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

    /** Presentation result captured after walking through the proposal. */
    presentProposal: {
      proposalAccepted: {
        type: String,
        enum: ["YES", "NO", ""],
        default: "",
      },
      initialQuotationNotes: {
        type: String,
        default: "",
        trim: true,
        validate: {
          validator(value) {
            const accepted = String(this?.proposalAccepted || "").trim().toUpperCase();
            return !["YES", "NO"].includes(accepted) || Boolean(String(value || "").trim());
          },
          message: "Notes on Quotation Proposal is required.",
        },
      },
      presentedAt: {
        type: Date,
        default: null,
      },
    },

    /** Generated/uploaded proposal file metadata and email-send flags. */
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
      uploadedAt: {
        type: Date,
        default: null,
      },
      // Backward compatibility for older records that used generatedAt.
      generatedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

proposalSchema.index({ leadEngagementId: 1, attemptCycle: 1 }, { unique: true });

module.exports = mongoose.model("Proposal", proposalSchema);
