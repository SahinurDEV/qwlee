const mongoose = require("mongoose");
const { paginate } = require("./plugins");

// Dispute resolution per PRD §5.10 / §8.1. Attached to a Payment
// (the canonical order record). Either party can open; admin issues
// the binding resolution if it escalates.
const disputeSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    initiatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    initiatorRole: {
      type: String,
      enum: ["buyer", "freelancer"],
      required: true,
    },
    reasonCode: {
      type: String,
      enum: [
        "not_as_described",
        "low_quality",
        "late_delivery",
        "no_delivery",
        "buyer_unresponsive",
        "scope_creep",
        "abusive_behavior",
        "other",
      ],
      required: true,
    },
    description: { type: String, required: true, maxlength: 2000 },
    attachments: { type: Array, default: [] },
    status: {
      type: String,
      enum: ["open", "awaiting_response", "escalated", "resolved", "cancelled"],
      default: "open",
      index: true,
    },
    responses: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["buyer", "freelancer", "admin"] },
        message: { type: String, required: true },
        attachments: { type: Array, default: [] },
        proposedResolution: {
          type: String,
          enum: [
            "full_refund",
            "partial_refund",
            "release_to_seller",
            "mutual_cancellation",
            null,
          ],
          default: null,
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    resolution: {
      type: String,
      enum: [
        "full_refund",
        "partial_refund",
        "release_to_seller",
        "mutual_cancellation",
        null,
      ],
      default: null,
    },
    resolutionNote: { type: String, default: "" },
    resolvedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

disputeSchema.plugin(paginate);

module.exports = mongoose.model("Dispute", disputeSchema);
