const mongoose = require("mongoose");
const { toJSON } = require("./plugins");

// A call scheduled inside an order: one side proposes time slots, the other
// picks one, and both get a meeting link (see orderCall.service).
const orderCallSchema = mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
    proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    topic: { type: String, trim: true, maxlength: 200, default: "" },
    durationMin: { type: Number, default: 30, min: 15, max: 120 },
    slots: [{ type: Date }],
    startsAt: { type: Date, default: null },
    meetingUrl: { type: String, default: "" },
    status: { type: String, enum: ["proposed", "scheduled", "declined", "cancelled"], default: "proposed", index: true },
  },
  { timestamps: true }
);
orderCallSchema.plugin(toJSON);
module.exports = mongoose.model("OrderCall", orderCallSchema);
