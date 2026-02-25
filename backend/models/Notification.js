/**
 * Notification Model
 * ------------------
 * Represents a user-facing notification assigned to a specific user.
 *
 * Primary use so far:
 * - Task notifications (added, due today, missed)
 *
 * Design supports:
 * - Read/unread tracking
 * - Linking a notification to a specific entity (Task, Policyholder)
 * - Dedupe support to prevent duplicate notifications
 */
const mongoose = require("mongoose"); // Import mongoose for schema/model definitions

/**
 * NOTIF_TYPES
 * -----------
 * Allowed notification categories.
 * Used as enum values for Notification.type.
 *
 * Current v1 types focus on tasks.
 * Future types are commented out for later expansion.
 */
const NOTIF_TYPES = [
  "TASK_ADDED",
  "TASK_DUE_TODAY",
  "TASK_MISSED",

  // future
  // "POLICY_PAYMENT_REMINDER",
  // "POLICY_LAPSED",
];

/**
 * NOTIF_STATUS
 * ------------
 * Allowed notification read states.
 */
const NOTIF_STATUS = ["Unread", "Read"];

/**
 * ENTITY_TYPES
 * ------------
 * Allowed entity types this notification can reference.
 * This lets the UI know what kind of item to open when clicking a notification.
 */
const ENTITY_TYPES = ["Task", "Policyholder"];

/**
 * notificationSchema
 * ------------------
 * Defines document structure, validation rules, normalization, and indexes.
 */
const notificationSchema = new mongoose.Schema(
  {
    /**
     * assignedToUserId (ObjectId reference to User)
     * ---------------------------------------------
     * Identifies which user receives this notification.
     *
     * required: true ensures every notification belongs to a user.
     * index: true supports fast retrieval of notifications per user.
     * ref: "User" allows populate("assignedToUserId") if needed.
     */
    assignedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /**
     * type (String enum)
     * ------------------
     * Classification of the notification.
     *
     * enum: NOTIF_TYPES restricts to allowed types.
     * required: true
     * index: true supports filtering by type.
     * trim: true cleans whitespace.
     *
     * set(...) normalizes:
     * - converts to string
     * - uppercases
     * - trims
     */
    type: {
      type: String,
      enum: NOTIF_TYPES,
      required: true,
      index: true,
      trim: true,
      set: (v) => String(v || "").toUpperCase().trim(),
    },

    /**
     * title (String)
     * --------------
     * Short headline shown in UI.
     *
     * required: true
     * trim: true
     * maxlength: 120 prevents overly long titles.
     */
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    /**
     * message (String)
     * ----------------
     * Optional detailed message shown under the title.
     *
     * default: "" stores empty string if not provided.
     * trim: true
     * maxlength: 500 caps message size.
     */
    message: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    /**
     * status (String enum)
     * --------------------
     * Read state: "Unread" or "Read".
     *
     * default: "Unread" means notifications start as unread.
     * required: true ensures consistency.
     * index: true supports queries like "unread count for user".
     */
    status: {
      type: String,
      enum: NOTIF_STATUS,
      default: "Unread",
      required: true,
      index: true,
    },

    /**
     * readAt (Date)
     * -------------
     * Timestamp for when a user marked the notification as read.
     *
     * default: null means unread (or read time not recorded yet).
     * index: true helps analytics/reporting on read times.
     */
    readAt: {
      type: Date,
      default: null,
      index: true,
    },

    /**
     * entityType (String enum)
     * ------------------------
     * Indicates what entity the notification is about (e.g., Task, Policyholder).
     *
     * required: true enforces every notification points to a known entity type.
     * index: true supports filtering notifications by entity type.
     */
    entityType: {
      type: String,
      enum: ENTITY_TYPES,
      required: true,
      index: true,
    },

    /**
     * entityId (ObjectId)
     * -------------------
     * Stores the MongoDB ObjectId of the referenced entity record.
     *
     * required: true ensures every notification actually links to something.
     * index: true supports lookups like:
     * - all notifications for a given task/policyholder
     *
     * NOTE:
     * - This field is not a Mongoose "ref" because entityType can vary.
     *   The application resolves which collection/model to query based on entityType.
     */
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    /**
     * dedupeKey (String)
     * ------------------
     * Optional key to prevent duplicate notifications.
     *
     * default: null
     * index: true
     * unique: true
     * sparse: true
     *
     * sparse: true means:
     * - uniqueness is enforced only for documents where dedupeKey exists (non-null)
     * - multiple documents can have dedupeKey = null without violating uniqueness
     */
    dedupeKey: { type: String, default: null, index: true, unique: true, sparse: true },
    
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
 * Compound Index: { assignedToUserId, status, createdAt }
 * ------------------------------------------------------
 * Optimizes notification list UI queries like:
 * - fetch unread notifications for a user, newest first
 *
 * createdAt: -1 means descending order index.
 */
notificationSchema.index({ assignedToUserId: 1, status: 1, createdAt: -1 });

/**
 * Partial Unique Index: { assignedToUserId, dedupeKey }
 * ----------------------------------------------------
 * Enforces uniqueness of dedupeKey PER USER, only when dedupeKey is a string.
 *
 * partialFilterExpression makes uniqueness apply only when:
 * - dedupeKey is of BSON type "string"
 *
 * Meaning:
 * - Users can have many notifications with dedupeKey = null (rule doesn't apply)
 * - If dedupeKey is set, the same user cannot have another notification with same dedupeKey
 */
notificationSchema.index(
  { assignedToUserId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } }
);

module.exports = mongoose.model("Notification", notificationSchema);
