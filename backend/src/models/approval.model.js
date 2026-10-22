const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

// Four-eyes approval for large money movements (refunds, payouts).
const approvalSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["refund", "tip-refund", "withdrawal"], required: true },
    targetId: { type: String, required: true },
    amount: { type: Number, default: 0 },
    method: { type: String, required: true },
    path: { type: String, required: true }, // API path to replay, e.g. /admin/orders/:id/refund
    body: { type: Object, default: {} },
    summary: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected", "failed"], default: "pending" },
    requestedBy: { type: mongoose.SchemaTypes.ObjectId, ref: "User", required: true },
    decidedBy: { type: mongoose.SchemaTypes.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    result: { type: String, default: "" },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true }
);
approvalSchema.index({ kind: 1, targetId: 1, status: 1 });
approvalSchema.plugin(toJSON);
approvalSchema.plugin(paginate);
module.exports = mongoose.model("Approval", approvalSchema);
