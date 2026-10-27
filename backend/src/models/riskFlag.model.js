const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

// Something the risk rules want a moderator to look at (risk.service).
const riskFlagSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["message", "gig", "request", "offer", "order", "chat"], required: true },
    targetId: { type: String, required: true },
    userId: { type: mongoose.SchemaTypes.ObjectId, ref: "User", default: null },
    reasons: [{ type: String }],
    excerpt: { type: String, default: "" },
    reportedBy: { type: mongoose.SchemaTypes.ObjectId, ref: "User", default: null },
    score: { type: Number, default: 1 },
    status: { type: String, enum: ["open", "dismissed", "actioned"], default: "open" },
    note: { type: String, default: "" },
    reviewedBy: { type: mongoose.SchemaTypes.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    // Highlights from the contact scanner / message AI.
    spans: [{ _id: false, start: Number, end: Number, reason: String, text: String }],
    chatId: { type: mongoose.SchemaTypes.ObjectId, ref: "Chat", default: null },
    aiSummary: { type: String, default: "" },
    // AI second-pass fraud review (never auto-bans; status stays open for a human)
    aiLabel: { type: String, default: "" },
    aiConfidence: { type: Number, default: null },
    aiRationale: { type: String, default: "" },
    aiEvidence: [{ source: String, quote: String, why: String }],
    aiSource: { type: String, default: "" },
    aiModel: { type: String, default: "" },
    aiReviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
riskFlagSchema.index({ status: 1, createdAt: -1 });
riskFlagSchema.index({ kind: 1, targetId: 1 });
riskFlagSchema.index({ chatId: 1, status: 1 });
riskFlagSchema.plugin(toJSON);
riskFlagSchema.plugin(paginate);
module.exports = mongoose.model("RiskFlag", riskFlagSchema);
