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
