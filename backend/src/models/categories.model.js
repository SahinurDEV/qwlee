const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const categoriesSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    // Legacy image URL (still used as a fallback when no icon is picked).
    image: {
      type: String,
      required: false,
      default: "",
    },
    // Emoji or short text glyph picked from the admin icon picker.
    // Preferred over `image` for taxonomy display since it renders
    // instantly with zero network cost.
    icon: {
      type: String,
      required: false,
      default: "",
    },
    // Set for subcategories; null/missing for top-level categories.
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Categories",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["online", "offline"],
      default: "online",
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
categoriesSchema.plugin(toJSON);
categoriesSchema.plugin(paginate);

const Categories = mongoose.model("Categories", categoriesSchema);

module.exports = Categories;
