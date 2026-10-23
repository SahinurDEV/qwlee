const mongoose = require("mongoose");

const privacySchema = new mongoose.Schema(
  {
    content: { type: String, required: [true, "Content is must be Required"] },
  },
  { timestamps: true }
);

privacySchema.plugin(require("./plugins/sanitizeHtmlFields.plugin"), { fields: ["content"] });

module.exports = mongoose.model("Privacy", privacySchema);
