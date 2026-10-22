const mongoose = require("mongoose");

// One row per ISO week the weekly KPI email went out (unique: a second
// instance or a retry can't send the same week twice).
const kpiReportSchema = new mongoose.Schema(
  { week: { type: String, required: true, unique: true }, summary: Object, recipients: Number, sentAt: Date },
  { timestamps: true }
);
module.exports = mongoose.model("KpiReport", kpiReportSchema);
