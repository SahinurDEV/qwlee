// Marketplace reviews — buyers rate a delivered order, sellers can
// reply once (Fiverr-style). `orderId` ties the review to a real
// transaction so the "one review per delivered order" rule has a
// reliable key, and so the order detail page can render a "Your review
// (Edit)" affordance instead of re-prompting.

const mongoose = require("mongoose");
const { paginate } = require("./plugins");

const sellerReplySchema = mongoose.Schema(
  {
    message: { type: String, trim: true, default: "" },
    repliedAt: { type: Date, default: null },
  },
  { _id: false }
);

const reviewSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "User",
      required: true,
    },
    freelancerId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "User",
      required: true,
    },
    gigId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "Gig",
      required: true,
    },
    // Optional on the schema (legacy seeded rows didn't have one) but
    // required from the API for any review created through the order
    // flow. Indexed for the duplicate-check on submit.
    orderId: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: "Orders",
      default: null,
      index: true,
    },
    review: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    // Optional Fiverr-style breakdown (1-5 each).
    subRatings: {
      communication: { type: Number, min: 1, max: 5, default: undefined },
      service: { type: Number, min: 1, max: 5, default: undefined },
      recommend: { type: Number, min: 1, max: 5, default: undefined },
    },
    sellerReply: { type: sellerReplySchema, default: () => ({}) },
  },
  {
    timestamps: true,
  }
);

reviewSchema.plugin(paginate);

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;
