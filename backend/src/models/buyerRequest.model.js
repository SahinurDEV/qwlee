const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

// A job post: a buyer describes what they need and sellers send offers.
const buyerRequestSchema = mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    categoriesId: { type: mongoose.Schema.Types.ObjectId, ref: "Categories", default: null, index: true },
    subCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Categories", default: null },
    budget: { type: Number, required: true, min: 5 },
    deliveryDays: { type: Number, required: true, min: 1, max: 90 },
    status: { type: String, enum: ["open", "closed", "hired"], default: "open", index: true },
    offersCount: { type: Number, default: 0 },
    hiredOfferId: { type: mongoose.Schema.Types.ObjectId, ref: "RequestOffer", default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
    expiresAt: { type: Date, index: true },
    // Sellers the buyer invited from talent search; their offers cost no credits.
    invitedSellerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
  },
  { timestamps: true }
);
buyerRequestSchema.plugin(toJSON);
buyerRequestSchema.plugin(paginate);

module.exports = mongoose.model("BuyerRequest", buyerRequestSchema);
