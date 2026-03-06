const mongoose = require("mongoose");

const MEETING_TYPE = ["Needs Assessment", "Proposal Presentation", "Application Submission"];
const MEETING_MODE = ["Online", "Face-to-face"];
const MEETING_PLATFORM = ["Zoom", "Google Meet", "Other"];
const MEETING_STATUS = ["Scheduled", "Completed", "Cancelled"];

const scheduledMeetingSchema = new mongoose.Schema(
  {
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      index: true,
    },
    meetingType: {
      type: String,
      enum: MEETING_TYPE,
      required: true,
      index: true,
    },
    startAt: {
      type: Date,
      required: true,
      index: true,
    },
    endAt: {
      type: Date,
      required: true,
      index: true,
    },
    durationMin: {
      type: Number,
      required: true,
      min: 30,
      max: 120,
    },
    mode: {
      type: String,
      enum: MEETING_MODE,
      required: true,
    },
    platform: {
      type: String,
      enum: MEETING_PLATFORM,
      default: undefined,
    },
    platformOther: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    link: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    inviteSent: {
      type: Boolean,
      default: false,
    },
    place: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    status: {
      type: String,
      enum: MEETING_STATUS,
      default: "Scheduled",
      index: true,
    },
  },
  { timestamps: true }
);

scheduledMeetingSchema.index({ leadEngagementId: 1, meetingType: 1 }, { unique: true });

module.exports = mongoose.model("ScheduledMeeting", scheduledMeetingSchema);
