/**
 * Prospect Model
 * --------------
 * Represents a sales prospect assigned to a specific user (typically an agent).
 * Includes:
 * - identity + contact details
 * - classification fields (market type, source, status)
 * - drop workflow enforcement (reason/notes/date)
 * - contact info versioning when phone number changes
 *
 * Collection name in MongoDB: "prospects"
 */
const mongoose = require("mongoose"); // Import mongoose for schema/model definitions

/**
 * DROP_REASONS
 * ------------
 * Central list of allowed reasons when a Prospect is marked as "Dropped".
 * Used as enum values for the dropReason field to enforce consistency.
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
 * prospectSchema
 * --------------
 * Defines structure, validation, indexes, and lifecycle hooks for Prospect documents.
 */
const prospectSchema = new mongoose.Schema(
  {
    /**
     * assignedToUserId
     * ----------------
     * Required reference to the User who owns/handles this prospect.
     *
     * index: true
     * - Improves query performance for listing prospects by assigned user.
     */
    assignedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /**
     * prospectCode
     * ------------
     * A unique string identifier for the prospect (e.g., system-generated code).
     *
     * unique: true
     * - Enforces global uniqueness across all prospects.
     *
     * index: true
     * - Speeds up lookups by prospectCode.
     */
    prospectCode: {
      type: String,
      unique: true,
      index: true,
    },

    /**
     * Name fields
     * -----------
     * trim: true removes leading/trailing spaces before saving.
     * middleName is optional and defaults to empty string.
     */
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true, default: "" },
    lastName: { type: String, required: true, trim: true },

    /**
     * phoneNumber
     * -----------
     * Required PH local format validation:
     * - Must start with 9
     * - Must be exactly 10 digits total
     *
     * match: regex validation with a custom error message
     * index: true improves filtering/searching by phoneNumber
     */
    phoneNumber: {
      type: String,
      required: true,
      match: [/^9\d{9}$/, "Phone must be 10 digits (PH local) and start with 9."],
      index: true,
    },

    /**
     * contactInfoVersion
     * ------------------
     * Tracks which version of contact info the prospect currently has.
     *
     * default: 1 (starts at version 1)
     * min: 1 (cannot go below 1)
     * index: true (useful for querying/filtering by version if needed)
     *
     * This is later auto-incremented in a pre("save") hook when phoneNumber changes.
     */
    contactInfoVersion: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      index: true,
    },

    /**
     * email
     * -----
     * Optional email:
     * - default "" (empty)
     * - trim: normalize whitespace
     * - lowercase: normalize casing
     *
     * match allows either:
     * - empty string (^$), OR
     * - valid email-ish format
     */
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      match: [
        /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Invalid email format",
      ],
    },

    /**
     * Optional demographic fields
     * ---------------------------
     * sex: restricted to Male/Female
     * birthday: date type (no validation here)
     * age: numeric constraints 18–70
     */
    sex: {
      type: String,
      enum: ["Male", "Female"],
    },

    birthday: {
      type: Date,
    },

    age: {
      type: Number,
      min: 18,
      max: 70,
    },

    civilStatus: {
      type: String,
      enum: ["Single", "Married", "Widowed", "Separated", "Annulled"],
      default: undefined,
    },

    occupationCategory: {
      type: String,
      enum: ["Employed", "Self-Employed", "Not Employed"],
      required: true,
      default: "Not Employed",
    },

    occupation: {
      type: String,
      trim: true,
      default: "",
      maxlength: 150,
    },

    address: {
      line: { type: String, trim: true, default: "" },
      barangay: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      otherCity: { type: String, trim: true, default: "" },
      region: { type: String, trim: true, default: "" },
      zipCode: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "Philippines" },
    },

    /**
     * marketType
     * ----------
     * Required classification: Warm or Cold.
     */
    marketType: {
      type: String,
      enum: ["Warm", "Cold"],
      required: true,
    },

    /**
     * prospectType
     * ------------
     * Optional classification: Elite or Ordinary.
     */
    prospectType: {
      type: String,
      enum: ["Elite", "Ordinary"],
    },

    /**
     * source
     * ------
     * Required field indicating where the prospect came from:
     * - System-Assigned
     * - Agent-Sourced
     */
    source: {
      type: String,
      enum: ["System-Assigned", "Agent-Sourced"],
      required: true,
    },

    /**
     * status
     * ------
     * Required current state of prospect:
     * - Active
     * - Wrong Contact
     * - Dropped
     *
     * index: true because status is commonly filtered in lists.
     */
    status: {
      type: String,
      enum: ["Active", "Wrong Contact", "Dropped"],
      required: true,
      index: true,
    },

    /**
     * Drop fields (used only when status === "Dropped")
     * -------------------------------------------------
     * dropReason:
     * - enum: must be one of DROP_REASONS
     * - default: undefined (so it doesn't store "" or a default value unless set)
     *
     * dropNotes:
     * - default: undefined (same idea)
     *
     * droppedAt:
     * - default: null
     * - index: true for reporting/filtering by drop date
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
     * Adds and maintains:
     * - createdAt
     * - updatedAt
     */
  { timestamps: true }
);

/**
 * Virtual: fullName
 * -----------------
 * Creates a computed property (not stored in DB) combining first/middle/last.
 * - If middleName is empty, it is omitted.
 * - .trim() ensures no extra spaces.
 */
prospectSchema.virtual("fullName").get(function () {
  const mid = this.middleName ? ` ${this.middleName}` : "";
  return `${this.firstName}${mid} ${this.lastName}`.trim();
});

prospectSchema.set("toJSON", { virtuals: true });
prospectSchema.set("toObject", { virtuals: true });

/**
 * Compound Unique Index: (assignedToUserId + phoneNumber)
 * -------------------------------------------------------
 * Prevents the same agent/user from having duplicate prospects with the same phone number.
 * This still allows different agents/users to have the same phone number if needed.
 *
 * Example:
 * - User A cannot have phone 9123456789 twice
 */
prospectSchema.index(
  { assignedToUserId: 1, phoneNumber: 1 },
  { unique: true }
);

/**
 * pre("validate") hook: Drop workflow enforcement
 * ----------------------------------------------
 * Runs BEFORE validation completes.
 *
 * If status === "Dropped":
 * - dropReason must be present and non-empty
 * - dropNotes must be present and non-empty
 * - droppedAt is auto-set to now if not provided
 *
 * Else (status is not Dropped):
 * - clears dropReason and dropNotes by setting them to undefined
 * - sets droppedAt back to null
 *
 * IMPORTANT:
 * - Uses this.invalidate(field, message) to cause validation error on missing fields.
 * - Clearing with undefined prevents storing empty strings in DB for non-dropped records.
 */
prospectSchema.pre("validate", function () {
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
 * pre("save") hook: contactInfoVersion management
 * ----------------------------------------------
 * Runs BEFORE saving to database.
 *
 * 1) Ensures contactInfoVersion is at least 1
 * 2) If updating an existing document (not new) AND phoneNumber changed:
 *    increment contactInfoVersion by 1
 *
 * IMPORTANT:
 * - Must not use arrow function because `this` must refer to the document.
 * - `this.isNew` checks if document is newly created.
 * - `this.isModified("phoneNumber")` checks if phoneNumber changed since last save.
 */
prospectSchema.pre("save", function () {

  if (!this.contactInfoVersion || this.contactInfoVersion < 1) {
    this.contactInfoVersion = 1;
  }

  // increment only when updating and phone number changed
  if (!this.isNew && this.isModified("phoneNumber")) {
    this.contactInfoVersion += 1;
  }
});


module.exports = mongoose.model("Prospect", prospectSchema);