/**
 * Task Model
 * ----------
 * Represents an actionable task assigned to a user (typically an agent) and tied to a Prospect.
 * Tasks can optionally be linked to a LeadEngagement for pipeline-related work.
 *
 * Key features implemented in this code:
 * - Task typing (fixed enum list)
 * - Status handling (Open/Done) with automatic completedAt management
 * - Normalization on save (type uppercased; status normalized)
 * - Validation rules for engagement-required task types
 * - Dashboard-friendly indexes + optional dedupeKey uniqueness support
 */

const mongoose = require("mongoose"); // Import mongoose for schema/model creation

/**
 * TASK_TYPES
 * ----------
 * Allowed values for Task.type.
 */
const TASK_TYPES = [
  "APPROACH", // Contact attempt
  "FOLLOW_UP",
  "APPOINTMENT",
  "PRESENTATION",
  "UPDATE_CONTACT_INFO",
];

/**
 * TASK_STATUS
 * -----------
 * Allowed values for Task.status.
 */
const TASK_STATUS = ["Open", "Done"];

/**
 * taskSchema
 * ----------
 * Defines structure, constraints, indexes, normalization, and validation hooks.
 */
const taskSchema = new mongoose.Schema(
  {
    /**
     * assignedToUserId (ObjectId reference to User)
     * ---------------------------------------------
     * Owner of the task (who needs to do it).
     *
     * required: true → tasks must always belong to a user.
     * index: true → improves performance for task lists per user.
     *
     * ref: "User" enables populate("assignedToUserId") if needed.
     */
    assignedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /**
     * prospectId (ObjectId reference to Prospect)
     * -------------------------------------------
     * Prospect this task belongs to.
     *
     * required: true → every task is tied to a prospect (for grouping/filtering).
     * index: true → speeds filtering by prospect.
     *
     * ref: "Prospect" enables populate("prospectId") if needed.
     */
    prospectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prospect",
      required: true,
      index: true,
    },

    /**
     * leadEngagementId (ObjectId reference to LeadEngagement)
     * -------------------------------------------------------
     * Optional link to engagement record (lead pipeline context).
     *
     * default: null → task can exist without being engagement-related.
     * index: true → improves filtering/reporting by engagement link.
     *
     * ref: "LeadEngagement" enables populate("leadEngagementId") if needed.
     */
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      default: null,
      index: true,
    },

    /**
     * type (String enum)
     * ------------------
     * Task category/type.
     *
     * enum: TASK_TYPES restricts values to known allowed task types.
     * required: true → task must be classified.
     * index: true → supports filtering by task type.
     * trim: true → cleans whitespace.
     *
     * set(...) normalizes the value on assignment/save:
     * - converts to string
     * - uppercases
     * - trims whitespace
     */
    type: {
      type: String,
      enum: TASK_TYPES,
      required: true,
      index: true,
      trim: true,
      set: (v) => String(v || "").toUpperCase().trim(),
    },

    /**
     * title (String)
     * --------------
     * Short task title displayed in UI.
     *
     * required: true
     * trim: true
     * maxlength: 120 → prevents overly long titles.
     */
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    /**
     * description (String)
     * --------------------
     * Optional details for the task.
     *
     * default: "" → stored as empty string if not provided.
     * trim: true
     * maxlength: 500
     */
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    /**
     * dueAt (Date)
     * ------------
     * Required due date/time of the task.
     *
     * required: true
     * index: true → supports queries like "tasks due today" / sorting by due date.
     */
    dueAt: {
      type: Date,
      required: true,
      index: true,
    },

    /**
     * status (String enum)
     * --------------------
     * Open/Done lifecycle state.
     *
     * enum: TASK_STATUS restricts values.
     * default: "Open"
     * required: true
     * index: true → supports filtering open vs done.
     *
     * set(...) normalizes user input:
     * - if the input lowercased equals "done" → store "Done"
     * - otherwise store "Open"
     *
     * Meaning:
     * - any non-"done" input becomes "Open" (including invalid strings)
     * - enum restriction still prevents invalid final values beyond Open/Done
     */
    status: {
      type: String,
      enum: TASK_STATUS,
      default: "Open",
      required: true,
      index: true,
      set: (v) => (String(v || "").toLowerCase() === "done" ? "Done" : "Open"),
    },

    /**
     * completedAt (Date)
     * ------------------
     * Timestamp when the task was completed.
     *
     * default: null
     * index: true → supports reporting (completed tasks by date).
     *
     * Consistency is enforced in pre("validate"):
     * - If status is Done → completedAt is set (if missing)
     * - If status is Open → completedAt cleared to null
     */
    completedAt: {
      type: Date,
      default: null,
      index: true,
    },

    /**
     * wasDelayed (Boolean)
     * --------------------
     * Tracks whether this task was completed after its dueAt deadline.
     *
     * - true  => completedAt is later than dueAt
     * - false => completed on/before dueAt, or task is still Open
     */
    wasDelayed: {
      type: Boolean,
      default: false,
      index: true,
    },

    /**
     * dedupeKey (String)
     * ------------------
     * Optional key used to prevent duplicates (especially useful for follow-up tasks).
     *
     * Example format (comment):
     *  - FOLLOW_UP:${leadId}:${YYYY-MM-DD}:#2
     *
     * default: null means no dedupe behavior unless set.
     * trim: true
     * index: true → supports searching tasks by dedupeKey.
     *
     * Uniqueness is optionally enforced later via partial unique index.
     */
    dedupeKey: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
  },
    /**
     * timestamps: true
     * ----------------
     * Automatically adds and maintains:
     * - createdAt
     * - updatedAt
     */
  { timestamps: true }
);

/**
 * pre("validate") hook: Task consistency + engagement requirements
 * ---------------------------------------------------------------
 * Runs before schema validation completes.
 *
 * Enforces:
 * 1) Done/Open consistency with completedAt
 * 2) Certain task types require leadEngagementId to be present
 */
taskSchema.pre("validate", function () {
  /**
   * Rule 1: Status vs completedAt consistency
   * - If Done: ensure completedAt exists (set to now if missing)
   * - If Open: clear completedAt to null
   *
   * This prevents inconsistent states like:
   * - status = Open but completedAt has a value
   * - status = Done but completedAt is null
   */
  if (this.status === "Done") {
    if (!this.completedAt) this.completedAt = new Date();
    if (this.dueAt instanceof Date && this.completedAt instanceof Date) {
      this.wasDelayed = this.completedAt.getTime() > this.dueAt.getTime();
    }
  } else {
    this.completedAt = null;
    this.wasDelayed = false;
  }

  /**
   * Rule 2: Engagement-required types must have leadEngagementId
   *
   * APPROACH / FOLLOW_UP / APPOINTMENT / PRESENTATION
   * - These are engagement/pipeline-related tasks.
   * - leadEngagementId must be present or validation fails.
   *
   * UPDATE_CONTACT_INFO
   * - Explicitly allowed without leadEngagementId.
   *
   */
  const t = String(this.type || "").toUpperCase();
  const requiresEngagement = ["APPROACH", "FOLLOW_UP", "APPOINTMENT", "PRESENTATION"].includes(t);

  if (requiresEngagement && !this.leadEngagementId) {
    this.invalidate("leadEngagementId", "leadEngagementId is required for engagement-related task types.");
  }
});

/**
 * Compound Index: { assignedToUserId, status, dueAt }
 * --------------------------------------------------
 * Dashboard/list optimization index.
 *
 * Makes queries fast like:
 * - "all Open tasks for user X sorted by dueAt"
 * - "all Done tasks for user X within a dueAt range"
 */
taskSchema.index({ assignedToUserId: 1, status: 1, dueAt: 1 });

/**
 * Partial Unique Index: { assignedToUserId, dedupeKey }
 * ----------------------------------------------------
 * Enforces uniqueness only when dedupeKey is a string.
 *
 * partialFilterExpression:
 * - Only applies the unique constraint if dedupeKey is of type "string"
 * - Allows multiple tasks with dedupeKey = null
 *
 * Meaning:
 * - If dedupeKey is set, user cannot have another task with same dedupeKey.
 * - If dedupeKey is null, uniqueness rule does not apply.
 */
taskSchema.index(
  { assignedToUserId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } }
);

module.exports = mongoose.model("Task", taskSchema);
