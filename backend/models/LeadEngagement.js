/**
 * LeadEngagement Model
 * --------------------
 * Tracks the engagement/pipeline progress of a Lead through defined sales stages.
 *
 * Key purpose:
 * - 1:1 relationship with Lead (each Lead has exactly one LeadEngagement record)
 * - Stores current pipeline stage and activity pointer
 * - Tracks stage start/completion timestamps
 * - Maintains a stageHistory array for audit / timeline reconstruction
 * - Tracks contact attempt summary counters (actual logs live in ContactAttempt collection)
 * - Provides scheduling hint for next contact attempt
 * - Includes contact info versioning to align attempts with the correct prospect contact data
 */
const mongoose = require("mongoose"); // Import mongoose for schema/model definitions

/**
 * STAGES
 * ------
 * Allowed values for the lead engagement pipeline.
 * Used as enum values to enforce stage consistency across the system.
 */
const STAGES = [
  "Not Started",
  "Contacting",
  "Needs Assessment",
  "Proposal",
  "Application",
  "Policy Issuance",
];

/**
 * leadEngagementSchema
 * --------------------
 * Defines structure, validation, indexes, and constraints for LeadEngagement documents.
 */
const leadEngagementSchema = new mongoose.Schema(
  {
    /**
     * leadId (ObjectId reference to Lead)
     * -----------------------------------
     * Enforces a 1:1 relationship with Lead.
     *
     * required: true → every engagement must be tied to a lead
     * unique: true   → prevents multiple engagements for the same lead
     * index: true    → speeds up lookups by leadId
     *
     * ref: "Lead" enables populate("leadId") to retrieve lead details.
     */
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      unique: true,
      index: true,
    },

    /**
     * currentStage (String enum)
     * --------------------------
     * Stores the lead's current pipeline stage.
     *
     * enum: STAGES restricts values to the predefined stage list.
     * default: "Not Started"
     * required: true ensures every document has a valid stage.
     * index: true supports filtering (e.g., show all leads in Proposal stage).
     */
    currentStage: {
      type: String,
      enum: STAGES,
      default: "Not Started",
      required: true,
      index: true,
    },

    /**
     * currentActivityKey (String)
     * ---------------------------
     * Stores an identifier (key) for the current activity inside the current stage.
     * This is typically used as a "pointer" for the UI/business logic
     * (e.g., which step inside "Contacting" is next).
     *
     * default: null
     * - explicitly null when Not Started
     *
     * trim: true normalizes whitespace.
     * index: true speeds up queries filtering by currentActivityKey if used.
     */
    currentActivityKey: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    /**
     * stageStartedAt / stageCompletedAt (Date)
     * ----------------------------------------
     * Tracks lifecycle timestamps for the current stage.
     *
     * default: null allows "Not Started" engagements to have no timestamps.
     *
     * Validation later ensures:
     * - stageStartedAt must exist once currentStage is not "Not Started"
     * - stageCompletedAt cannot be earlier than stageStartedAt
     */
    stageStartedAt: {
      type: Date,
      default: null,
    },
    stageCompletedAt: {
      type: Date,
      default: null,
    },

    /**
     * stageHistory (Array of stage entries)
     * -------------------------------------
     * Audit trail of stage transitions over time.
     * Each entry stores:
     * - stage (required, must be one of STAGES)
     * - startedAt (required)
     * - completedAt (optional)
     * - reason (optional text; default "")
     *
     * This enables:
     * - reconstructing the pipeline timeline
     * - reporting how long leads stay in each stage
     * - documenting why a stage ended/changed (reason)
     */
    stageHistory: [
      {
        stage: {
          type: String,
          enum: STAGES,
          required: true,
        },
        startedAt: {
          type: Date,
          required: true,
        },
        completedAt: {
          type: Date,
          default: null,
        },
        reason: {
          type: String,
          default: "",
          trim: true,
        },
      },
    ],

    /**
     * isBlocked (Boolean)
     * -------------------
     * Blocking flag that can prevent progress/actions on this lead.
     *
     * default: false
     * index: true supports quickly filtering blocked engagements.
     *
     * - TRUE === invalid contact info (for now)
     */
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },

    /**
     * Contact attempt summary counters
     * -------------------------------
     * These fields summarize contact attempts.
     * The detailed per-attempt logs are stored in the ContactAttempt collection.
     *
     * contactAttemptsCount:
     * - total number of attempts recorded for this engagement/lead
     *
     * lastContactAttemptNo:
     * - last attempt sequence number (e.g., attempt #3)
     *
     * lastContactAttemptAt:
     * - timestamp of the most recent attempt
     *
     * min: 0 prevents negative values.
     */
    contactAttemptsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastContactAttemptNo: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastContactAttemptAt: {
      type: Date,
      default: null,
    },

    /**
     * nextAttemptAt (Date)
     * --------------------
     * Scheduling guidance field for when the next contact attempt should happen (If Not Responded).
     *
     * default: null when no scheduled next attempt exists.
     * index: true supports queries like "show me follow-ups due today".
     */
    nextAttemptAt: {
      type: Date,
      default: null,
      index: true,
    },

    /**
     * contactInfoVersionAtStart / currentContactInfoVersion (Number)
     * --------------------------------------------------------------
     * Versioning fields used to keep contact attempts aligned with
     * the correct version of the prospect's contact info.
     *
     * contactInfoVersionAtStart:
     * - contact info version when engagement started (baseline)
     *
     * currentContactInfoVersion:
     * - tracks current version in use for engagement
     *
     * default: 1 and min: 1 enforce valid version numbers.
     */
    contactInfoVersionAtStart: {
      type: Number,
      default: 1,
      min: 1,
    },
    currentContactInfoVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
    /**
     * timestamps: true
     * ----------------
     * Adds and maintains:
     * - createdAt
     * - updatedAt
     */
  { timestamps: true }
);

/**
 * pre("validate") hook: Stage timestamp validation
 * ------------------------------------------------
 * Runs before Mongoose validation completes.
 *
 * Rules enforced:
 * 1) If currentStage is NOT "Not Started", stageStartedAt must exist.
 * 2) If stageCompletedAt exists AND stageStartedAt exists:
 *    stageCompletedAt cannot be earlier than stageStartedAt.
 */
leadEngagementSchema.pre("validate", function () {
  // Rule 1: engagement must have a start date once it is beyond Not Started
  if (this.currentStage !== "Not Started" && !this.stageStartedAt) {
    this.invalidate("stageStartedAt", "stageStartedAt is required once engagement has started.");
  }
  
  // Rule 2: completion date must not precede start date
  if (this.stageCompletedAt && this.stageStartedAt) {
    if (this.stageCompletedAt < this.stageStartedAt) {
      this.invalidate("stageCompletedAt", "stageCompletedAt cannot be earlier than stageStartedAt.");
    }
  }
});


module.exports = mongoose.model("LeadEngagement", leadEngagementSchema);
