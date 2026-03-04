const mongoose = require("mongoose");

const GENDER = ["Male", "Female"];
const DEPENDENT_RELATIONSHIP = ["Child", "Parent", "Sibling"];
const NEEDS_ASSESSMENT_ACTIVITY = [
  "Record Prospect Attendance",
  "Perform Needs Analysis",
  "Schedule Proposal Presentation",
];


const MONTHLY_INCOME_BANDS = [
  "BELOW_15000",
  "15000_29999",
  "30000_49999",
  "50000_79999",
  "80000_99999",
  "100000_249999",
  "250000_499999",
  "ABOVE_500000",
];

const PRIORITIES = ["Protection", "Health", "Investment"];
const INVESTMENT_SAVINGS_PLANS = ["Home", "Vehicle", "Holiday", "Early Retirement", "Other"];
const RISK_PROFILE_CATEGORY = ["NOT_RECOMMENDED", "CONSERVATIVE", "MODERATE", "AGGRESSIVE"];

const needsAssessmentSchema = new mongoose.Schema(
  {
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      index: true,
    },

    // Store latest completed Needs Assessment activity (activity flow source remains LeadEngagement.currentActivityKey)
    outcomeActivity: {
      type: String,
      enum: NEEDS_ASSESSMENT_ACTIVITY,
      default: "Record Prospect Attendance",
    },

    attendanceConfirmed: {
      type: Boolean,
      default: false,
    },
    attendedAt: {
      type: Date,
      default: null,
    },

    // Phase 1 - Optional dependents (inline array objects; no separate schema)
    dependents: {
      type: [
        {
          name: { type: String, required: true, trim: true, maxlength: 150 },
          age: { type: Number, required: true, min: 0, max: 120 },
          gender: { type: String, enum: GENDER, required: true },
          relationship: { type: String, enum: DEPENDENT_RELATIONSHIP, required: true },
        },
      ],
      default: [],
    },

    needsPriorities: {
      currentPriority: { type: String, enum: PRIORITIES, default: "" },
      monthlyIncomeBand: { type: String, enum: MONTHLY_INCOME_BANDS, default: "" },
      monthlyIncomeAmount: { type: Number, min: 0, default: null },
      minPremium: { type: Number, min: 0, default: null },
      maxPremium: { type: Number, min: 0, default: null },

      protection: {
        monthlySpend: { type: Number, min: 0, default: null },
        numberOfDependents: { type: Number, min: 0, default: null },
        yearsToProtectIncome: { type: Number, min: 0, default: null },
        savingsForProtection: { type: Number, min: 0, default: null },
        protectionGap: { type: Number, default: null },
      },

      health: {
        amountToCoverCriticalIllness: { type: Number, min: 0, default: null },
        savingsForCriticalIllness: { type: Number, min: 0, default: null },
        criticalIllnessGap: { type: Number, default: null },
      },

      investment: {
        savingsPlan: { type: String, enum: INVESTMENT_SAVINGS_PLANS, default: "" },
        savingsPlanOther: { type: String, trim: true, default: "" },
        targetSavingsAmount: { type: Number, min: 0, default: null },
        targetUtilizationYear: { type: Number, min: 1900, default: null },
        savingsForInvestment: { type: Number, min: 0, default: null },
        savingsGap: { type: Number, default: null },
        riskProfiler: {
          investmentHorizon: {
            type: String,
            enum: ["LT_3", "BETWEEN_3_7", "BETWEEN_7_10", "AT_LEAST_10"],
            default: "",
          },
          investmentGoal: {
            type: String,
            enum: ["CAPITAL_PRESERVATION", "STEADY_GROWTH", "SIGNIFICANT_APPRECIATION"],
            default: "",
          },
          marketExperience: {
            type: String,
            enum: ["NONE", "I_ONLY", "II_ONLY", "BOTH"],
            default: "",
          },
          volatilityReaction: {
            type: String,
            enum: ["FULL_WITHDRAW", "LESS_RISKY", "HOLD", "TOP_UPS"],
            default: "",
          },
          capitalLossAffordability: {
            type: String,
            enum: ["NO_LOSS", "UP_TO_5", "UP_TO_10", "ABOVE_10"],
            default: "",
          },
          riskReturnTradeoff: {
            type: String,
            enum: ["PORTFOLIO_A", "PORTFOLIO_B", "PORTFOLIO_C", "PORTFOLIO_D"],
            default: "",
          },
          riskProfileScore: { type: Number, min: 0, max: 21, default: null },
          riskProfileCategory: { type: String, enum: RISK_PROFILE_CATEGORY, default: "" },
        },
      },
    },
  },
  { timestamps: true }
);

needsAssessmentSchema.index({ leadEngagementId: 1 }, { unique: true });

module.exports = mongoose.model("NeedsAssessment", needsAssessmentSchema);
