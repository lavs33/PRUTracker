/**
 * BM Model
 * --------
 * Stores the Branch Manager extension record for a promoted Agent.
 *
 * This model mirrors the manager-role pattern used by AUM/UM while attaching
 * the promoted user to a Branch instead of a Unit.
 */
const mongoose = require("mongoose");

/**
 * bmSchema
 * --------
 * One-to-one branch-manager record tied to Agent/User identities.
 */
const bmSchema = new mongoose.Schema(
  {
    /** agentId keeps the promoted Agent relationship unique. */
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      unique: true,
    },

    /** userId points at the actual login/account used by the BM. */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    /** branchId identifies the branch this manager currently handles. */
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    /** Block flags allow temporary operational suspension without deletion. */
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

module.exports = mongoose.model("BM", bmSchema);
