/**
 * Retirement Model
 * ----------------
 * Stores retirement details recorded for an Agent, including retirement date,
 * required supporting documents, orphan-client endorsement status, and affected
 * client snapshots used by manager workflows.
 */
const mongoose = require("mongoose");

const affectedClientSchema = new mongoose.Schema(
  {
    reassigned: { type: Boolean, default: false },
  },
  { _id: false, strict: false }
);

const retirementSchema = new mongoose.Schema(
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
    retirementDate: {
      type: Date,
      required: true,
    },
    retirementLetter: {
      fileName: { type: String, required: true, trim: true },
      mimeType: { type: String, required: true, trim: true },
      dataUrl: { type: String, required: true },
    },
    approvedRetirementProof: {
      fileName: { type: String, required: true, trim: true },
      mimeType: { type: String, required: true, trim: true },
      dataUrl: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ["Recorded", "Confirmed Orphans", "Endorsed"],
      default: "Recorded",
      index: true,
    },
    affectedProspects: {
      type: [affectedClientSchema],
      default: [],
    },
    affectedPolicyholders: {
      type: [affectedClientSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Retirement", retirementSchema);