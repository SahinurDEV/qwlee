const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const disputeAiSuggestionSchema = new mongoose.Schema(
  {
    disputeId: { type: mongoose.SchemaTypes.ObjectId, ref: "Dispute", required: true, index: true },
    adminId: { type: mongoose.SchemaTypes.ObjectId, ref: "User", index: true },
    promptHash: { type: String, default: "", index: true },
    model: { type: String, default: "" },
    source: { type: String, enum: ["remote", "mock", "mock-fallback"], default: "mock" },
    latencyMs: { type: Number, default: 0 },
    suggestion: { type: Object, default: {} },
    status: {
      type: String,
      enum: ["suggested", "accepted", "dismissed", "edited"],
      default: "suggested",
      index: true,
    },
    acceptedOutcome: { type: String, default: null },
    acceptedNote: { type: String, default: "" },
    acceptedAmount: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

disputeAiSuggestionSchema.plugin(toJSON);
disputeAiSuggestionSchema.plugin(paginate);
module.exports = mongoose.model("DisputeAiSuggestion", disputeAiSuggestionSchema);
