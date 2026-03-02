const mongoose = require("mongoose");

const GENDER = ["Male", "Female", "Other"];
const DEPENDENT_RELATIONSHIP = ["Child", "Parent", "Sibling"];
const needsAssessmentSchema = new mongoose.Schema(
  {
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      index: true,
    },
    attendanceConfirmed: {
      type: Boolean,
      default: false,
    },
    attendedAt: {
      type: Date,
      default: null,
    },

    needsAnalysisCompletedAt: {
      type: Date,
      default: null,
    },

    proposalPresentationScheduledAt: {
      type: Date,
      default: null,
    },

    // Phase 1 - Optional dependents (inline array objects; no separate schema)
    dependents: {
      type: [
        {
          name: { type: String, required: true, trim: true, maxlength: 150 },
          age: { type: Number, required: true, min: 0, max: 120 },
          gender: { type: String, enum: GENDER, required: true },
          relationship: { type: String, enum: DEPENDENT_RELATIONSHIP, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

needsAssessmentSchema.index({ leadEngagementId: 1 }, { unique: true });

module.exports = mongoose.model("NeedsAssessment", needsAssessmentSchema);
