/**
 * UM Model
 * --------
 * Stores the Unit Manager extension record for a promoted Agent.
 *
 * Similar to AUM, but represents the full Unit Manager role.
 */
const mongoose = require("mongoose");

/**
 * umSchema
 * --------
 * One-to-one role record linking an Agent/User identity to a managed Unit.
 */
const umSchema = new mongoose.Schema(
  {
    /** agentId keeps the promoted-agent mapping unique. */
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      unique: true,
    },

    /** userId links the manager role to the actual login record. */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    /** unitId identifies which unit this UM owns/supervises. */
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
    },

    /** Block flags support temporary access restriction. */
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
    timestamps: true,
  }
);

module.exports = mongoose.model("UM", umSchema);
