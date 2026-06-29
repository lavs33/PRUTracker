/**
 * LongLeave Model
 * ---------------
 * Stores long-leave details recorded for an Agent, including required leave
 * dates and supporting proof documents used by branch workflows.
 */
const mongoose = require("mongoose");

const longLeaveSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    leaveStartDate: {
      type: Date,
      required: true,
    },
    leaveEndDate: {
      type: Date,
      required: true,
    },
    leaveApplicationForm: {
      fileName: { type: String, required: true, trim: true },
      mimeType: { type: String, required: true, trim: true },
      dataUrl: { type: String, required: true },
    },
    approvedLeaveProof: {
      fileName: { type: String, required: true, trim: true },
      mimeType: { type: String, required: true, trim: true },
      dataUrl: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ["Draft", "Pending Endorsement", "Endorsed", "Cancelled"],
      default: "Draft",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LongLeave", longLeaveSchema);
