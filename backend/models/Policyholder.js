/**
 * Policyholder Model
 * ------------------
 * Represents a successfully converted client (Lead → Policyholder).
 *
 * A Policyholder:
 * - Has a unique internal code
 * - Is managed by a specific User (typically agent)
 * - Is linked to the Lead that converted
 * - Stores insurer-issued policy number
 * - Tracks payment and lifecycle status
 *
 * Collection name in MongoDB: "policyholders"
 */
const mongoose = require("mongoose"); // Import mongoose for schema/model creation

/**
 * policyholderSchema
 * ------------------
 * Defines structure, constraints, and indexes for Policyholder documents.
 */
const policyholderSchema = new mongoose.Schema(
  {
    /**
     * policyholderCode (String)
     * -------------------------
     * Human-readable internal identifier for the policyholder.
     *
     * required: true → cannot create policyholder without a code.
     * unique: true → globally unique across collection.
     * index: true → fast lookup by code.
     * trim: true → removes leading/trailing whitespace.
     */
    policyholderCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    /**
     * assignedToUserId (ObjectId reference to User)
     * ---------------------------------------------
     * Identifies the User (typically agent) managing this policyholder.
     *
     * required: true → ensures every policyholder has a manager.
     * index: true → fast filtering of policyholders per user.
     *
     * ref: "User" enables populate("assignedToUserId").
     */
    assignedToUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /**
     * leadId (ObjectId reference to Lead)
     * -----------------------------------
     * References the Lead that converted into this policyholder.
     *
     * required: true → ensures traceability from prospect → lead → policyholder.
     * index: true → fast lookup by originating lead.
     *
     * ref: "Lead" enables populate("leadId").
     */
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },

    /**
     * policyNumber (String)
     * ---------------------
     * Unique policy number issued by the insurer.
     *
     * required: true
     * unique: true → globally unique across all policyholders.
     * index: true → supports fast lookup by policy number.
     * trim: true → cleans whitespace.
     *
     * Ensures no two policyholders can share the same policy number.
     */
    policyNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    /**
     * lastPaidDate (Date)
     * -------------------
     * Stores the most recent successful premium payment date.
     *
     * required: true → policyholder cannot exist without initial payment record.
     * index: true → supports queries like:
     *   - overdue payment detection
     *   - lapsed policy identification
     */
    lastPaidDate: {
      type: Date,
      required: true,
      index: true,
    },

    /**
     * status (String enum)
     * --------------------
     * Lifecycle status of the policy.
     *
     * enum: ["Active", "Lapsed", "Cancelled"]
     * default: "Active"
     * index: true → supports filtering/reporting by status.
     */
    status: {
      type: String,
      enum: ["Active", "Lapsed", "Cancelled"],
      default: "Active",
      index: true,
    },
  },
    /**
     * timestamps: true
     * ----------------
     * Automatically adds:
     * - createdAt → when policyholder record was created
     * - updatedAt → when it was last modified
     */
  { timestamps: true }
);

module.exports = mongoose.model("Policyholder", policyholderSchema);
