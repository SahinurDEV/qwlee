const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is required"] },
    image: { type: String, required: [true, "Cover image is required"] },
    author: { type: String, required: [true, "Author is required"] },
    slug: { type: String, required: [true, "Slug is required"], unique: true, index: true },
    content: { type: String, required: [true, "Content is required"] },
    description: { type: String, required: [true, "Excerpt is required"] },
    kind: { type: String, enum: ["article", "guide"], default: "article", index: true },
    // CMS fields
    status: { type: String, enum: ["draft", "scheduled", "published"], default: "published", index: true },
    scheduledAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    featured: { type: Boolean, default: false, index: true },
    categories: [{ type: String }],
    tags: [{ type: String }],
    readingTimeMin: { type: Number, default: 1 },
    seo: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      ogImage: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

blogSchema.plugin(paginate);
blogSchema.plugin(toJSON);
blogSchema.plugin(require("./plugins/sanitizeHtmlFields.plugin"), { fields: ["content"] });

blogSchema.pre("validate", function (next) {
  if (!this.readingTimeMin && this.content) {
    const words = String(this.content).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    this.readingTimeMin = Math.max(1, Math.round(words / 200));
  }
  if (this.status === "published" && !this.publishedAt) this.publishedAt = new Date();
  next();
});

module.exports = mongoose.model("Blog", blogSchema);
