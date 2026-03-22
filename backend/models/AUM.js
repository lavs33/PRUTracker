/**
 * AUM Model
 * ---------
 * Stores the Assistant Unit Manager extension record for a promoted Agent.
 *
 * Purpose:
 * - keeps manager-role metadata separate from the base Agent/User records
 * - links the promoted agent to the Unit they supervise
 * - tracks whether the manager account is blocked from acting in the system
 */
const mongoose = require("mongoose");

/**
 * aumSchema
 * ---------
 * Defines the one-to-one manager record for an Assistant Unit Manager.
 */
const aumSchema = new mongoose.Schema(
  {
    /**
     * agentId (ObjectId → Agent)
     * ---------------------------
     * Back-reference to the promoted Agent profile.
     * unique: true preserves a one-to-one mapping.
     */
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      unique: true,
    },

    /**
     * userId (ObjectId → User)
     * ------------------------
     * Direct link to the login/account record used by this manager.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    /**
     * unitId (ObjectId → Unit)
     * ------------------------
     * Unit currently handled by this AUM.
     */
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
    },

    /**
     * isBlocked / blockedAt
     * ---------------------
     * Operational access-control flags for temporary manager blocking.
     */
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockedAt: {
      type: Date,
      default: null,
    },
  },
  {
    // createdAt / updatedAt support auditing manager role changes.
    timestamps: true,
  }
);

module.exports = mongoose.model("AUM", aumSchema);