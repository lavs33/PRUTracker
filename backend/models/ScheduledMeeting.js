/**
 * ScheduledMeeting Model
 * ----------------------
 * Represents a scheduled meeting attached to a LeadEngagement.
 *
 * Used for Contacting, Proposal, and Application stage calendar-style meeting
 * details. A unique (leadEngagementId, meetingType) pair ensures there is only
 * one active record per meeting category for the engagement.
 */
const mongoose = require("mongoose");

/** Shared meeting enums to keep UI/business logic values consistent. */
const MEETING_TYPE = ["Needs Assessment", "Proposal Presentation", "Application Submission"];
const MEETING_MODE = ["Online", "Face-to-face"];
const MEETING_PLATFORM = ["Zoom", "Google Meet", "Other"];
const MEETING_STATUS = ["Scheduled", "Completed", "Cancelled"];

/**
 * scheduledMeetingSchema
 * ----------------------
 * Stores timing, channel, and status metadata for an engagement meeting.
 */
const scheduledMeetingSchema = new mongoose.Schema(
  {
    /** Owning lead engagement for this scheduled meeting. */
    leadEngagementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadEngagement",
      required: true,
      index: true,
    },

    /** Business meeting type (needs assessment / proposal / application). */
    meetingType: {
      type: String,
      enum: MEETING_TYPE,
      required: true,
      index: true,
    },

    /** Start/end timestamps drive scheduling, reminders, and duration checks. */
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

    /** Online vs face-to-face controls which supporting fields are relevant. */
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

    /** Current lifecycle state of the scheduled meeting entry. */
    status: {
      type: String,
      enum: MEETING_STATUS,
      default: "Scheduled",
      index: true,
    },
  },
  { timestamps: true }
);

// One meeting record per engagement + meeting type combination.
scheduledMeetingSchema.index({ leadEngagementId: 1, meetingType: 1 }, { unique: true });

module.exports = mongoose.model("ScheduledMeeting", scheduledMeetingSchema);