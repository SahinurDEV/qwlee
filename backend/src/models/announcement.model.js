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
  },
  { timestamps: true }
);
announcementSchema.plugin(toJSON);
announcementSchema.plugin(paginate);
module.exports = mongoose.model("Announcement", announcementSchema);
