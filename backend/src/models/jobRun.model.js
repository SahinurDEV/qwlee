const mongoose = require("mongoose");

// One row per background job step run (kept 14 days).
const jobRunSchema = new mongoose.Schema({
  job: { type: String, required: true, index: true },
  startedAt: { type: Date, required: true },
  ms: Number,
  ok: Boolean,
  error: String,
  result: mongoose.Schema.Types.Mixed,
  trigger: { type: String, enum: ["timer", "manual"], default: "timer" },
});
jobRunSchema.index({ startedAt: 1 }, { expireAfterSeconds: 14 * 86400 });
jobRunSchema.index({ job: 1, startedAt: -1 });
module.exports = mongoose.model("JobRun", jobRunSchema);
