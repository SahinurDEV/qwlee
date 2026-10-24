const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const ordersSchema = mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    items: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        freelancerId: { type: mongoose.SchemaTypes.ObjectId, ref: "User" },
      },
    ],
    messageId: {
      type: String,
      required: false,
    },
    freelancerId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "User",
    },
    clientId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "User",
    },
    gigId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "Gig",
    },
    data: {
      type: Object,
      required: true,
    },
    price: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["active", "late", "delivered", "cancelled", "disputed"],
      default: "active",
    },
    // Set when a dispute is opened so we can pop the order back to
    // its prior state if the dispute is dropped/cancelled.
    preDisputeStatus: { type: String, default: "" },
    refundReason: { type: String, default: "" },
    activeDisputeId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "Dispute",
      default: null,
    },
    deliveryDate: {
      type: Date,
    },
    // Seller-initiated delivery-date extension. Fiverr-style: seller
    // requests a new date with a reason → buyer accepts (date moves,
    // status reset to active) or declines (request marked declined,
    // original date stays). `status === "none"` means no current
    // request — keeps the field self-describing for the UI.
    coupon: { code: String, discount: Number },
    // Mutual cancellation request (see cancellation.service).
    cancellationRequest: {
      status: { type: String, enum: ["none", "pending", "accepted", "auto-accepted", "declined", "withdrawn"], default: "none" },
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      byRole: { type: String, default: "" },
      reason: { type: String, default: "" },
      requestedAt: { type: Date, default: null },
      respondBy: { type: Date, default: null },
      respondedAt: { type: Date, default: null },
    },
    // Buyer's "ask for an update" (orderRequests.service). One open at a time.
    updateRequest: {
      status: { type: String, enum: ["none", "pending", "answered"], default: "none" },
      note: { type: String, default: "" },
      reply: { type: String, default: "" },
      requestedAt: { type: Date, default: null },
      answeredAt: { type: Date, default: null },
    },
    extensionRequest: {
      newDeliveryDate: { type: Date, default: null },
      reason: { type: String, default: "" },
      status: {
        type: String,
        enum: ["none", "pending", "accepted", "declined"],
        default: "none",
      },
      requestedAt: { type: Date, default: null },
      respondedAt: { type: Date, default: null },
    },
    // Cancellation audit trail. Populated when an admin (or buyer) cancels
    // the order so we can answer "who cancelled this and why" months later.
    // Escrow: full payment held on the order until release/refund.
    escrow: {
      status: { type: String, enum: ["held", "released", "refunded"], default: undefined },
      platformFunded: { type: Number, default: 0 },
      // Buyer service fee paid on top of `amount` (kept by the platform).
      serviceFee: { type: Number, default: 0 },
      amount: { type: Number },
      provider: { type: String },
      heldAt: { type: Date },
      releasedAt: { type: Date },
      refundedAt: { type: Date },
      // Milestone releases made before completion (see milestones.service).
      releasedGross: { type: Number, default: 0 },
      releasedFee: { type: Number, default: 0 },
      releasedNet: { type: Number, default: 0 },
      // Money actually returned to the buyer (see refunds.service).
      refund: {
        provider: String, // stripe | demo
        id: String,
        status: { type: String, enum: ["pending", "succeeded", "failed"] },
        amount: Number,
        error: String,
        at: Date,
      },
    },
    // Buyer requirements gate (Fiverr: clock starts when submitted).
    requirementsStatus: {
      type: String,
      enum: ["not_required", "pending", "submitted"],
      default: "not_required",
    },
    requirementsSubmittedAt: { type: Date, default: null },
    // Seller delivery state within an open order.
    delivery: {
      state: { type: String, enum: ["none", "submitted", "revision", "accepted"], default: "none" },
      count: { type: Number, default: 0 },
      lastDeliveredAt: { type: Date, default: null },
      autoCompleteAt: { type: Date, default: null },
    },
    revisions: [{ reason: String, requestedAt: Date, _id: false }],
    completedAt: { type: Date, default: null },
    completionReason: { type: String, default: "" },
    // Tips the buyer added after completion (credited to the seller net of fee).
    tips: [
      {
        amount: Number,
        fee: Number,
        net: Number,
        provider: String,
        sessionId: String,
        at: { type: Date, default: Date.now },
        // Set when an admin returns the tip to the buyer.
        refund: { provider: String, id: String, status: String, amount: Number, error: String, at: Date, reason: String },
      },
    ],
    // Settlement snapshot written when the seller is credited, so later
    // refunds reverse exactly what was paid even if the fee changes.
    platformFeePercent: { type: Number, default: null },
    platformFee: { type: Number, default: null },
    sellerEarning: { type: Number, default: null },
    // Settlement snapshot written when the seller is credited, so later
    // refunds reverse exactly what was paid even if the fee changes.
    platformFeePercent: { type: Number, default: null },
    platformFee: { type: Number, default: null },
    sellerEarning: { type: Number, default: null },
    cancellationReason: { type: String, default: "" },
    cancelledBy: { type: mongoose.SchemaTypes.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    cancelledFromStatus: { type: String, default: "" },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
ordersSchema.plugin(paginate);

const Payment = mongoose.model("Payment", ordersSchema);

module.exports = Payment;
