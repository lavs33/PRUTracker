
/**
 * NeedsAssessment Model
 * ---------------------
 * Persists the Needs Assessment stage data for one LeadEngagement.
 *
 * This document captures:
 * - attendance confirmation/evidence
 * - dependent information
 * - needs-priority calculations and product selection
 * - optional rider choices
 * - investment risk-profiling answers and fund allocation choices
 */
const mongoose = require("mongoose");

/**
 * Enumerations
 * ------------
 * Centralized allowed values for the nested needs-assessment fields.
 */
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

/**
 * needsAssessmentSchema
 * ---------------------
 * Nested schema that stores stage outputs for the Needs Assessment process.
 */
const needsAssessmentSchema = new mongoose.Schema(
  {
    /** Owning LeadEngagement for this one-to-one needs assessment record. */
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
    },

    /** Latest completed subactivity saved in this document. */
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
    attendanceProofImageDataUrl: {
      type: String,
      trim: true,
      default: "",
    },
    attendanceProofFileName: {
      type: String,
      trim: true,
      maxlength: 255,
      default: "",
    },

    /** Optional dependent records entered during needs analysis. */
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

    /** Main needs-analysis payload grouped by business priority. */
    needsPriorities: {
      currentPriority: { type: String, enum: PRIORITIES, default: undefined },
      monthlyIncomeBand: { type: String, enum: MONTHLY_INCOME_BANDS, default: undefined },
      monthlyIncomeAmount: { type: Number, min: 0, default: null },
      minPremium: { type: Number, min: 0, default: null },
      maxPremium: { type: Number, min: 0, default: null },
      productSelection: {
        selectedProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
        requestedPremiumPayment: { type: Number, min: 0, default: null },
        requestedFrequency: {
          type: String,
          enum: ["Monthly", "Quarterly", "Half-yearly", "Yearly"],
          default: "Monthly",
        },
      },
      optionalRiders: [
        {
          riderKey: { type: String, trim: true, default: "" },
          riderName: { type: String, trim: true, default: "" },
          enabled: { type: Boolean, default: false },
        },
      ],
      productRidersNotes: { type: String, trim: true, maxlength: 2000, default: "" },

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
        savingsPlan: { type: String, enum: INVESTMENT_SAVINGS_PLANS, default: undefined },
        savingsPlanOther: { type: String, trim: true, default: "" },
        targetSavingsAmount: { type: Number, min: 0, default: null },
        targetUtilizationYear: { type: Number, min: 1900, default: null },
        savingsForInvestment: { type: Number, min: 0, default: null },
        savingsGap: { type: Number, default: null },
        riskProfiler: {
          investmentHorizon: {
            type: String,
            enum: ["LT_3", "BETWEEN_3_7", "BETWEEN_7_10", "AT_LEAST_10"],
            default: undefined,
          },
          investmentGoal: {
            type: String,
            enum: ["CAPITAL_PRESERVATION", "STEADY_GROWTH", "SIGNIFICANT_APPRECIATION"],
            default: undefined,
          },
          marketExperience: {
            type: String,
            enum: ["NONE", "I_ONLY", "II_ONLY", "BOTH"],
            default: undefined,
          },
          volatilityReaction: {
            type: String,
            enum: ["FULL_WITHDRAW", "LESS_RISKY", "HOLD", "TOP_UPS"],
            default: undefined,
          },
          capitalLossAffordability: {
            type: String,
            enum: ["NO_LOSS", "UP_TO_5", "UP_TO_10", "ABOVE_10"],
            default: undefined,
          },
          riskReturnTradeoff: {
            type: String,
            enum: ["PORTFOLIO_A", "PORTFOLIO_B", "PORTFOLIO_C", "PORTFOLIO_D"],
            default: undefined,
          },
          riskProfileScore: { type: Number, min: 0, max: 21, default: null },
          riskProfileCategory: { type: String, enum: RISK_PROFILE_CATEGORY, default: undefined },
        },
        fundChoice: {
          selectedFunds: [
            {
              fundKey: { type: String, trim: true, default: "" },
              fundName: { type: String, trim: true, default: "" },
              currency: { type: String, enum: ["PHP", "USD"], default: "PHP" },
              riskRating: { type: Number, min: 1, max: 3, default: null },
              allocationPercent: { type: Number, min: 0, max: 100, default: 0 },
              isSuitable: { type: Boolean, default: false },
            },
          ],
          totalAllocationPercent: { type: Number, min: 0, max: 100, default: 0 },
          fundMatch: { type: String, enum: ["Yes", "No"], default: "Yes" },
          mismatchReason: { type: String, trim: true, default: "" },
        },
      },
    },
  },
  { timestamps: true }
);

needsAssessmentSchema.index({ leadEngagementId: 1 }, { unique: true });

module.exports = mongoose.model("NeedsAssessment", needsAssessmentSchema);
