const mongoose = require("mongoose");

// A buyer's monthly subscription to one gig package. Each billing cycle
// creates a normal order (see subscription.service).
const subscriptionSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gigId: { type: mongoose.Schema.Types.ObjectId, ref: "Gig", required: true },
    packageName: { type: String, required: true },
    discountPercent: { type: Number, default: 0 },
    price: { type: Number, required: true }, // per cycle, after discount
    status: { type: String, enum: ["active", "paused", "cancelled"], default: "active", index: true },
    nextBillingAt: { type: Date, required: true, index: true },
    cycles: [
      {
        _id: false,
        at: Date,
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
        amount: Number,
        status: { type: String, enum: ["paid", "failed"] },
        error: String,
      },
    ],
    cancelledAt: Date,
  },
  { timestamps: true }
);
subscriptionSchema.index({ buyerId: 1, gigId: 1, packageName: 1, status: 1 });

module.exports = mongoose.model("Subscription", subscriptionSchema);
