/**
 * Lead Model
 * ----------
 * Represents a sales lead that is ALWAYS associated with a Prospect.
 * A Lead tracks the sales lifecycle (New → In Progress → Closed) and supports
 * a controlled "Dropped" workflow with required reason/notes/date.
 *
 * Key enforcement:
 * - Each lead has a unique human-readable leadCode.
 * - Each lead must reference exactly one Prospect (prospectId).
 * - Only one ACTIVE lead (New or In Progress) is allowed per Prospect at a time.
 */
const mongoose = require("mongoose"); // Import mongoose for schema/model creation

/**
 * DROP_REASONS
 * ------------
 * Allowed drop reasons when a lead is marked as Dropped.
 * Used as enum values for dropReason to keep drop classification consistent.
 */
const DROP_REASONS = [
  "Interest / Engagement",
  "Eligibility / Fit",
  "Data / System",
  "Compliance / Risk",
  "Life Event",
  "Other",
];

/**
 * leadSchema
 * ----------
 * Defines the Lead document structure, validation rules, and indexes.
 */
const leadSchema = new mongoose.Schema(
  {
    /**
     * leadCode (String)
     * -----------------
     * Human-readable unique identifier for a lead.
     *
     * required: true
     * - Lead cannot be created without a leadCode.
     *
     * unique: true
     * - Enforces global uniqueness across all leads.
     *
     * index: true
     * - Speeds up lookups by leadCode and listing/sorting use cases.
     *
     * trim: true
     * - Removes leading/trailing spaces before validation/save.
     */
    leadCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    /**
     * prospectId (ObjectId reference to Prospect)
     * -------------------------------------------
     * Mandatory relationship: a Lead is ALWAYS tied to a Prospect.
     *
     * required: true
     * - Prevents orphan leads.
     *
     * ref: "Prospect"
     * - Allows populate("prospectId") to fetch prospect details when needed.
     */
    prospectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prospect",
      required: true,
    },

    /**
     * source (String enum)
     * --------------------
     * Required lead source classification.
     *
     * enum list ensures only supported sources can be saved.
     * required: true forces the system to always classify the lead source.
     * index: true speeds filtering/reporting by source.
     */
    source: {
      type: String,
      enum: [
        "Family",
        "Friend",
        "Acquaintance",
        "Webinars",
        "Seminars/Conferences",
        "Other",
        "System",
      ],
      required: true,
      index: true,
    },

    /**
     * otherSource (String)
     * --------------------
     * Only applicable when source === "Other".
     *
     * default: undefined
     * - Field will not exist unless explicitly set.
     * - Prevents storing empty strings for non-Other sources.
     *
     * trim: true cleans whitespace.
     *
     * NOTE:
     * - Actual requirement is enforced in pre("validate") hook below.
     */
    otherSource: {
      type: String,
      trim: true,
      default: undefined,
    },

    /**
     * description (String)
     * --------------------
     * Optional free-text description of the lead.
     *
     * default: "" means it will store an empty string if not provided.
     * trim: true removes extra whitespace.
     */
    description: {
      type: String,
      default: "",
      trim: true,
    },

    /**
     * status (String enum)
     * --------------------
     * Sales lifecycle status of the lead.
     *
     * enum: New, In Progress, Closed, Dropped
     * default: "New"
     * required: true ensures every lead has a valid lifecycle state.
     * index: true speeds status filtering (e.g., active leads list).
     */
    status: {
      type: String,
      enum: ["New", "In Progress", "Closed", "Dropped"],
      default: "New",
      required: true,
      index: true,
    },

    /**
     * statusBeforeDrop (String enum)
     * ------------------------------
     * Stores the last non-dropped status so "Re-open" can restore correctly.
     *
     * enum: only allows "New" or "In Progress"
     * default: undefined → field not stored unless set.
     * trim: true normalizes whitespace.
     */
    statusBeforeDrop: {
      type: String,
      enum: ["New", "In Progress"],
      default: undefined,
      trim: true,
    },

    /**
     * dropReason / dropNotes / droppedAt
     * ----------------------------------
     * Fields required when status === "Dropped".
     *
     * dropReason:
     * - restricted to DROP_REASONS enum for consistent classification
     * - default: undefined prevents storing if not dropped
     *
     * dropNotes:
     * - free text notes explaining the drop
     * - default: undefined prevents storing if not dropped
     *
     * droppedAt:
     * - date the lead was dropped
     * - default: null (explicitly cleared when not dropped)
     * - index: true supports reporting/filtering by drop date
     */
    dropReason: {
      type: String,
      enum: DROP_REASONS,
      default: undefined,
      trim: true,
    },

    dropNotes: {
      type: String,
      default: undefined,
      trim: true,
    },

    droppedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
    /**
     * timestamps: true
     * ----------------
     * Automatically adds:
     * - createdAt
     * - updatedAt
     */
  { timestamps: true }
);


/**
 * pre("validate") hook: Source + Drop rules
 * ----------------------------------------
 * Runs before mongoose validates the document.
 * This hook enforces conditional requirements and clears irrelevant fields.
 */
leadSchema.pre("validate", function () {
  /**
   * Source validation:
   * - If source is "Other", otherSource becomes required.
   * - If source is not "Other", otherSource is cleared (set to undefined).
   */
  if (this.source === "Other" && !String(this.otherSource || "").trim()) {
    this.invalidate("otherSource", "Other source is required when source is Other.");
  }
  if (this.source !== "Other") this.otherSource = undefined;

  /**
   * Drop validation:
   * - If status is "Dropped", require dropReason + dropNotes and set droppedAt if missing.
   * - Otherwise, clear drop-related fields (no empty strings stored).
   */
  if (this.status === "Dropped") {
    if (!String(this.dropReason || "").trim()) {
      this.invalidate("dropReason", "Drop reason is required.");
    }
    if (!String(this.dropNotes || "").trim()) {
      this.invalidate("dropNotes", "Drop notes are required.");
    }
    if (!this.droppedAt) this.droppedAt = new Date();
  } else {
    this.dropReason = undefined;
    this.dropNotes = undefined;
    this.droppedAt = null;
  }
});

/**
 * Partial Unique Index: only ONE active lead per prospect
 * ------------------------------------------------------
 * This index enforces that a Prospect can have at most one Lead in an ACTIVE state:
 * - "New" or "In Progress"
 *
 * Implementation details:
 * - unique: true applies uniqueness constraint.
 * - partialFilterExpression limits uniqueness to documents where:
 *   status is in ["New", "In Progress"].
 *
 * Meaning:
 * - You cannot create a second lead for the same prospect if the existing lead is New/In Progress.
 * - But you CAN create a new lead for the same prospect if the previous one is Closed or Dropped.
 */
leadSchema.index(
  { prospectId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["New", "In Progress"] },
    },
  }
);

module.exports = mongoose.model("Lead", leadSchema);
