const mongoose = require("mongoose");

// Admin overrides for one transactional email (key = email.service
// function name). Empty fields keep the built-in text.
const emailTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    subject: { type: String, default: "", maxlength: 200 },
    heroTitle: { type: String, default: "", maxlength: 200 },
    intro: { type: String, default: "", maxlength: 2000 },
    footerNote: { type: String, default: "", maxlength: 1000 },
    ctaLabel: { type: String, default: "", maxlength: 60 },
    disabled: { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
module.exports = mongoose.model("EmailTemplate", emailTemplateSchema);
