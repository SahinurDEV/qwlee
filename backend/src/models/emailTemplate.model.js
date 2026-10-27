const mongoose = require("mongoose");

// Admin overrides for one transactional email (key = email.service
// function name). Empty fields keep the built-in text. Optional `blocks`
// power the CMS-style visual builder; `versions` keeps restore history.
const blockSchema = new mongoose.Schema(
  {
    id: String,
    type: { type: String, enum: ["header", "text", "button", "image", "divider", "footer"], required: true },
    text: { type: String, default: "" },
    url: { type: String, default: "" },
    align: { type: String, enum: ["left", "center", "right"], default: "left" },
    style: { type: String, enum: ["light", "brand", "dark"], default: "light" },
  },
  { _id: false }
);

const versionSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    snapshot: { type: Object },
  },
  { _id: false }
);

const emailTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    subject: { type: String, default: "", maxlength: 200 },
    heroTitle: { type: String, default: "", maxlength: 200 },
    intro: { type: String, default: "", maxlength: 2000 },
    footerNote: { type: String, default: "", maxlength: 1000 },
    ctaLabel: { type: String, default: "", maxlength: 60 },
    disabled: { type: Boolean, default: false },
    blocks: { type: [blockSchema], default: undefined },
    versions: { type: [versionSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
module.exports = mongoose.model("EmailTemplate", emailTemplateSchema);
