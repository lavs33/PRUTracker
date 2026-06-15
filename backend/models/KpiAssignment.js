const mongoose = require("mongoose");

const kpiAssignmentSchema = new mongoose.Schema(
  {
    scopeType: {
      type: String,
      enum: ["AGENT", "UNIT", "BRANCH"],
      required: true,
      index: true,
    },
    scopeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    kpis: [
      {
        key: { type: String, required: true, trim: true },
        label: { type: String, required: true, trim: true },
        period: { type: String, enum: ["Weekly", "Monthly"], required: true },
        valueType: { type: String, enum: ["Count", "Currency", "Percent", "Index"], required: true },
        assigned: { type: Boolean, default: true },
        targetMin: { type: Number, default: null },
        targetMax: { type: Number, default: null },
        targetValue: { type: Number, default: null },
      },
    ],
    updatedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

kpiAssignmentSchema.index({ scopeType: 1, scopeId: 1 }, { unique: true });

module.exports = mongoose.model("KpiAssignment", kpiAssignmentSchema);
