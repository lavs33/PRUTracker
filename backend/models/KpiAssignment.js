const mongoose = require("mongoose");

const monthlyAssignmentSchema = new mongoose.Schema(
  {
    monthKey: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    assigned: { type: Boolean, default: false },
    targetMin: { type: Number, default: null },
    targetMax: { type: Number, default: null },
    targetValue: { type: Number, default: null },
  },
  { _id: false }
);

// Monthly assignments are the canonical KPI storage model for every scope.
const kpiSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    valueType: { type: String, enum: ["Count", "Currency", "Percent", "Index"], required: true },
    monthlyAssignments: { type: [monthlyAssignmentSchema], default: [] },
  },
  { _id: false }
);

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
    kpis: { type: [kpiSchema], default: [] },
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
