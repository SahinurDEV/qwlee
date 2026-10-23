const mongoose = require("mongoose");

const trustSafety = new mongoose.Schema(
  {
    content: { type: String, required: [true, "Content is must be Required"] },
  },
  { timestamps: true }
);

trustSafety.plugin(require("./plugins/sanitizeHtmlFields.plugin"), { fields: ["content"] });

module.exports = mongoose.model("TrustSafety", trustSafety);
