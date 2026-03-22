const mongoose = require("mongoose");

const APPLICATION_ACTIVITY = [
  "Record Prospect Attendance",
  "Record Premium Payment Transfer",
  "Record Application Submission",
];

const RENEWAL_PAYMENT_METHODS = [
  "Credit Card / Debit Card",
  "Mobile Wallet / GCash",
  "Dated Check",
  "Bills Payments",
];

const applicationSchema = new mongoose.Schema(
  {
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      unique: true,
      index: true,
    },
    // Store latest completed Application activity (activity flow source remains LeadEngagement.currentActivityKey)
    outcomeActivity: {
      type: String,
      enum: APPLICATION_ACTIVITY,
      default: "Record Prospect Attendance",
      required: true,
      index: true,
    },
    chosenProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    recordProspectAttendance: {
      attended: {
        type: Boolean,
        default: false,
      },
      attendedAt: {
        type: Date,
        default: null,
      },
      attendanceProofImageDataUrl: {
        type: String,
        default: "",
      },
      attendanceProofFileName: {
        type: String,
        default: "",
        trim: true,
      },
    },
    recordPremiumPaymentTransfer: {
      totalAnnualPremiumPhp: {
        type: Number,
        default: null,
      },
      totalFrequencyPremiumPhp: {
        type: Number,
        default: null,
      },
      methodForInitialPayment: {
        type: String,
        enum: [...RENEWAL_PAYMENT_METHODS, ""],
        default: "",
        trim: true,
      },
      methodForRenewalPayment: {
        type: String,
        enum: [...RENEWAL_PAYMENT_METHODS, ""],
        default: "",
        trim: true,
      },
      paymentProofImageDataUrl: {
        type: String,
        default: "",
      },
      paymentProofFileName: {
        type: String,
        default: "",
        trim: true,
      },
      savedAt: {
        type: Date,
        default: null,
      },
    },
    recordApplicationSubmission: {
      pruOneTransactionId: {
        type: String,
        default: "",
        trim: true,
      },
      submissionScreenshotImageDataUrl: {
        type: String,
        default: "",
      },
      submissionScreenshotFileName: {
        type: String,
        default: "",
        trim: true,
      },
      savedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);


applicationSchema.index(
  { "recordApplicationSubmission.pruOneTransactionId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      "recordApplicationSubmission.pruOneTransactionId": { $type: "string", $ne: "" },
    },
  }
);

module.exports = mongoose.model("Application", applicationSchema);