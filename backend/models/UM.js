const mongoose = require("mongoose");

const umSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      unique: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UM", umSchema);
