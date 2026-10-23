const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

// A seller's offer on a buyer request. One per seller per request.
const requestOfferSchema = mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "BuyerRequest", required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    gigId: { type: mongoose.Schema.Types.ObjectId, ref: "Gig", default: null },
    // Proposal credits taken for this offer (credits.service).
    credits: { spent: { type: Number, default: 0 }, from: { type: String, default: "" }, refunded: { type: Boolean, default: false } },
    price: { type: Number, required: true, min: 5 },
    deliveryDays: { type: Number, required: true, min: 1, max: 90 },
    revisions: { type: Number, default: 1, min: 0, max: 20 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ["pending", "accepted", "declined", "withdrawn"], default: "pending", index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
  },
  { timestamps: true }
);
requestOfferSchema.index({ requestId: 1, sellerId: 1 }, { unique: true });
requestOfferSchema.plugin(toJSON);
requestOfferSchema.plugin(paginate);

module.exports = mongoose.model("RequestOffer", requestOfferSchema);
