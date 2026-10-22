// A user's saved message snippets ("quick responses" on Fiverr).
const mongoose = require("mongoose");

const quickReplySchema = new mongoose.Schema(
  {
    user: { type: mongoose.SchemaTypes.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 60 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuickReply", quickReplySchema);
