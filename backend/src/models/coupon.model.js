// Discount codes. Platform-funded: the buyer pays less, the seller is
// still paid on the full order price (escrow.platformFunded covers it).
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 32 },
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 0.01 },
    maxDiscount: { type: Number, default: null }, // cap for percent coupons
    minOrder: { type: Number, default: 0 },
    maxUses: { type: Number, default: null }, // null = unlimited
    perUserLimit: { type: Number, default: 1 },
    uses: { type: Number, default: 0 },
    redemptions: [{ user: { type: mongoose.SchemaTypes.ObjectId, ref: "User" }, order: { type: mongoose.SchemaTypes.ObjectId, ref: "Payment" }, amount: Number, at: Date, _id: false }],
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    // Restrict to one account (referral rewards) or first orders only.
    onlyUser: { type: mongoose.SchemaTypes.ObjectId, ref: "User", default: null },
    firstOrderOnly: { type: Boolean, default: false },
    source: { type: String, enum: ["admin", "referral"], default: "admin" },
    note: { type: String, default: "", maxlength: 200 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", couponSchema);
