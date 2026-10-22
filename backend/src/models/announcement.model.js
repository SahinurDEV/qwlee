const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 2000 },
    audience: { type: String, enum: ["all", "buyers", "sellers"], default: "all" },
    link: { type: String, default: "" },
    sendEmail: { type: Boolean, default: false },
    recipients: { type: Number, default: 0 },
    emailed: { type: Number, default: 0 },
    createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: "User" },
    // Targeting beyond the audience (announcements.service).
    target: {
      location: { type: String, default: "" }, // text the user's location contains
      joinedWithinDays: { type: Number, default: 0 },
      activeWithinDays: { type: Number, default: 0 },
      verifiedOnly: { type: Boolean, default: false },
      hasOrdered: { type: String, enum: ["any", "yes", "no"], default: "any" },
    },
    // Scheduling: "scheduled" ones are sent by housekeeping at sendAt.
    status: { type: String, enum: ["scheduled", "sending", "sent", "cancelled", "failed"], default: "sent" },
    sendAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    error: { type: String, default: "" },
  },
  { timestamps: true }
);
announcementSchema.index({ status: 1, sendAt: 1 });
announcementSchema.plugin(toJSON);
announcementSchema.plugin(paginate);
module.exports = mongoose.model("Announcement", announcementSchema);
