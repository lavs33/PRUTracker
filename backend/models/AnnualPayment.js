/**
 * AnnualPayment Model
 * -------------------
 * Represents one annual premium obligation period for a lead/policyholder.
 * Individual Payment records link back to this annual cycle.
 */
const mongoose = require("mongoose");

const PREMIUM_PAYMENT_FREQUENCIES = ["Monthly", "Quarterly", "Half-yearly", "Yearly"];
const ANNUAL_PAYMENT_STATUSES = ["Not Started", "Ongoing", "Completed"];

const annualPaymentSchema = new mongoose.Schema(
  {
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      unique: true,
      index: true,
    },

    annualPaymentPeriod: {
      startDate: {
        type: Date,
        default: null,
      },
      endDate: {
        type: Date,
        default: null,
      },
      label: {
        type: String,
        default: "",
        trim: true,
      },
    },

    totalAnnualPremiumPhp: {
      type: Number,
      default: null,
    },
    amountPaidSoFarPhp: {
      type: Number,
      default: 0,
    },
    remainingBalancePhp: {
      type: Number,
      default: 0,
    },
    frequencyOfPayment: {
      type: String,
      enum: [...PREMIUM_PAYMENT_FREQUENCIES, ""],
      default: "",
      trim: true,
    },
    paymentProgress: {
      paidCount: {
        type: Number,
        default: 0,
      },
      totalCount: {
        type: Number,
        default: 0,
      },
      label: {
        type: String,
        default: "0/0",
        trim: true,
      },
    },
    status: {
      type: String,
      enum: ANNUAL_PAYMENT_STATUSES,
      default: "Not Started",
      index: true,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AnnualPayment", annualPaymentSchema);
