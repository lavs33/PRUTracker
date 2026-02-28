/**
 * ContactAttempt Model
 * --------------------
 * Represents a single contact attempt made during a LeadEngagement.
 *
 * Each ContactAttempt:
 * - Belongs to exactly one LeadEngagement
 * - Has a sequential attempt number per engagement
 * - Records communication channel(s), response, and outcome
 * - Locks attemptedAt timestamp after creation
 * - Tracks which contact info version was used
 *
 * Collection name in MongoDB: "contactattempts"
 */
const mongoose = require("mongoose"); // Import mongoose for schema/model creation


/**
 * Enumerations
 * ------------
 * Centralized allowed values for validation consistency.
 */
const CHANNELS = ["Call", "SMS", "WhatsApp", "Viber", "Telegram"];
const RESPONSE = ["Responded", "No Response"];
const ACTIVITIES = [
  "Attempt Contact",
  "Validate Contact",
  "Wrong Contact",
  "Assess Interest",
  "Schedule Meeting",
];
const PHONE_VALIDATION = ["CORRECT", "WRONG_CONTACT"];
const INTEREST_LEVEL = ["INTERESTED", "NOT_INTERESTED"];
const PREFERRED_CHANNEL = ["SMS", "WhatsApp", "Viber", "Telegram", "Other"];
const MEETING_MODE = ["Online", "Face-to-face"];
const MEETING_PLATFORM = ["Zoom", "Google Meet", "Other"];

/**
 * contactAttemptSchema
 * --------------------
 * Defines structure, constraints, validation rules, and indexes.
 */
const contactAttemptSchema = new mongoose.Schema(
  {
    /**
     * leadEngagementId (ObjectId reference to LeadEngagement)
     * ------------------------------------------------------
     * Required relationship field.
     *
     * required: true → prevents orphan attempts.
     * index: true → speeds up queries filtering attempts by engagement.
     *
     * ref: "LeadEngagement"
     * - Enables populate("leadEngagementId") if needed.
     */
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      index: true,
    },

    /**
     * attemptNo (Number)
     * ------------------
     * Sequential attempt number within a specific LeadEngagement.
     *
     * required: true
     * min: 1 → prevents zero or negative attempt numbers.
     *
     * NOTE:
     * - Uniqueness per engagement is enforced later via compound index.
     */
    attemptNo: {
      type: Number,
      required: true,
      min: 1,
    },

    /**
     * primaryChannel (String enum)
     * ----------------------------
     * Required main communication channel used for this attempt.
     *
     * enum: CHANNELS restricts values to allowed channels.
     * required: true ensures every attempt has a defined primary method.
     * index: true supports filtering/reporting by channel.
     */
    primaryChannel: {
      type: String,
      enum: CHANNELS,
      required: true,
      index: true,
    },

    /**
     * otherChannels (Array of String enums)
     * ------------------------------------
     * Optional additional channels used during the same attempt.
     *
     * enum: CHANNELS → restricts each array value.
     * default: [] → ensures array exists even if empty.
     *
     * Custom validator enforces:
     * 1) Must be an array.
     * 2) No duplicate values.
     * 3) Must not include primaryChannel.
     */
    otherChannels: {
      type: [String],
      enum: CHANNELS,
      default: [],
      validate: {
        validator: function (arr) {
          if (!Array.isArray(arr)) return false;

          // Rule 1: no duplicate values
          if (new Set(arr).size !== arr.length) return false;

          // Rule 2: cannot include primaryChannel
          if (this.primaryChannel && arr.includes(this.primaryChannel)) return false;
          return true;
        },
        message: "otherChannels must be unique and must not include primaryChannel.",
      },
    },

    /**
     * attemptedAt (Date)
     * ------------------
     * Timestamp of when the contact attempt occurred.
     *
     * default: Date.now → auto-sets to current time at creation.
     * required: true
     * immutable: true → cannot be modified after document creation.
     * index: true → supports time-based reporting and sorting.
     *
     * IMPORTANT:
     * - immutable: true ensures historical integrity of attempt logs.
     */
    attemptedAt: {
      type: Date,
      default: Date.now,
      required: true,
      immutable: true, 
      index: true,
    },

    /**
     * response (String enum)
     * ----------------------
     * Indicates whether the prospect responded.
     *
     * enum: RESPONSE restricts to "Responded" or "No Response".
     * required: true ensures every attempt records outcome state.
     * index: true supports filtering by response type.
     */
    response: {
      type: String,
      enum: RESPONSE,
      required: true,
      index: true,
    },

    /**
     * outcomeActivity (String enum)
     * -----------------------------
     * Indicates what happened as a result of this attempt.
     *
     * enum: ACTIVITIES restricts values.
     * default: "Attempt Contact"
     * index: true supports reporting by outcome.
     */
    outcomeActivity: {
      type: String,
      enum: ACTIVITIES,
      default: "Attempt Contact",
      index: true,
    },

    /**
     * contactInfoVersion (Number)
     * ---------------------------
     * Stores which contact info version was used for this attempt.
     *
     * required: true
     * default: 1
     * min: 1
     * index: true supports tracking attempts by contact version.
     *
     * This aligns with Prospect.contactInfoVersion and
     * LeadEngagement.currentContactInfoVersion.
     */
    contactInfoVersion: {
      type: Number,
      default: 1,
      min: 1,
      required: true,
      index: true,
    },

    /**
     * notes (String)
     * --------------
     * Optional free-text notes about the attempt.
     *
     * default: ""
     * trim: true removes extra whitespace.
     * maxlength: 500 limits note length.
     */
    notes: {
      type: String,
      default: "",
      trim: true, 
      maxlength: 500,
    },

    phoneValidation: {
      type: String,
      enum: PHONE_VALIDATION,
      default: undefined,
    },

    interestLevel: {
      type: String,
      enum: INTEREST_LEVEL,
      default: undefined,
    },

    preferredChannel: {
      type: String,
      enum: PREFERRED_CHANNEL,
      default: undefined,
    },

    preferredChannelOther: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    meetingAt: {
      type: Date,
      default: null,
    },

    meetingMode: {
      type: String,
      enum: MEETING_MODE,
      default: undefined,
    },

    meetingPlatform: {
      type: String,
      enum: MEETING_PLATFORM,
      default: undefined,
    },

    meetingPlatformOther: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    meetingLink: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    meetingInviteSent: {
      type: Boolean,
      default: false,
    },

    meetingPlace: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
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
 * Compound Unique Index
 * ---------------------
 * Ensures attemptNo is unique per LeadEngagement.
 *
 * Meaning:
 * - For a given leadEngagementId, attemptNo cannot repeat.
 * - Attempt #1, #2, #3 etc must be sequentially unique within that engagement.
 *
 * Does NOT prevent different engagements from using the same attemptNo.
 */
contactAttemptSchema.index(
  { leadEngagementId: 1, attemptNo: 1 },
  { unique: true }
);

module.exports = mongoose.model("ContactAttempt", contactAttemptSchema);
