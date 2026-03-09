const mongoose = require("mongoose");

const APPLICATION_ACTIVITY = [
  "Record Prospect Attendance",
  "Record Premium Payment Transfer",
  "Record Application Submission",
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", applicationSchema);
