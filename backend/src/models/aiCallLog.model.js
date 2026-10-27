const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

// Lightweight observability for AI sidecar calls. No prompts / PII stored.
const aiCallLogSchema = new mongoose.Schema(
  {
    feature: {
      type: String,
      enum: ["dispute", "support", "search", "fraud", "insights"],
      required: true,
      index: true,
    },
    source: { type: String, default: "" }, // remote | mock | mock-fallback | fallback
    model: { type: String, default: "" },
    latencyMs: { type: Number, default: 0 },
    ok: { type: Boolean, default: true },
    error: { type: String, default: "" },
  },
  { timestamps: true }
);
aiCallLogSchema.index({ createdAt: -1 });
aiCallLogSchema.plugin(toJSON);
aiCallLogSchema.plugin(paginate);
module.exports = mongoose.model("AiCallLog", aiCallLogSchema);
