const mongoose = require("mongoose");

// Help centre / FAQ article (admin-edited, plain text with blank-line
// paragraphs and "- " bullet lines).
const helpArticleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: String, default: "General", trim: true, maxlength: 60, index: true },
    audience: { type: String, enum: ["all", "buyer", "seller"], default: "all" },
    body: { type: String, default: "", maxlength: 20000 },
    published: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    helpfulYes: { type: Number, default: 0 },
    helpfulNo: { type: Number, default: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
helpArticleSchema.index({ title: "text", body: "text", category: "text" });

module.exports = mongoose.model("HelpArticle", helpArticleSchema);
