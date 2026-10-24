const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Title is must be Required"] },
    image: { type: String, required: [true, "Image is must be Required"] },
    author: { type: String, required: [true, "Author is must be Required"] },
    slug: { type: String, required: [true, "Link is must be Required"] },
    content: { type: String, required: [true, "Content is must be Required"] },
    description: {
      type: String,
      required: [true, "Description is must be Required"],
    },
    // "guide" posts are how-tos listed under /guides and in the Help centre.
    kind: { type: String, enum: ["article", "guide"], default: "article", index: true },
  },
  { timestamps: true }
);

blogSchema.plugin(paginate);

blogSchema.plugin(require("./plugins/sanitizeHtmlFields.plugin"), { fields: ["content"] });

module.exports = mongoose.model("Blog", blogSchema);
