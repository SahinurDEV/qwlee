// Seller's review of the buyer on a completed order (Fiverr-style
// two-way reviews). Double-blind: the buyer and the public only see it
// once the buyer has reviewed the order too, or the review window closed.
const mongoose = require("mongoose");

const buyerReviewSchema = mongoose.Schema(
  {
    orderId: { type: mongoose.SchemaTypes.ObjectId, ref: "Payment", required: true, unique: true },
    sellerId: { type: mongoose.SchemaTypes.ObjectId, ref: "User", required: true, index: true },
    buyerId: { type: mongoose.SchemaTypes.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, trim: true, default: "" },
    // When it became visible (buyer reviewed, or the window closed).
    publishedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BuyerReview", buyerReviewSchema);
