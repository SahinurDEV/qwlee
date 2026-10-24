// Seller earnings waiting out the clearance period (Fiverr-style). Each
// credit is one row; the housekeeping job moves due rows into the
// seller's withdrawable balance.
const mongoose = require("mongoose");

const clearanceSchema = mongoose.Schema(
  {
    userId: { type: mongoose.SchemaTypes.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true },
    source: { type: String, default: "order" }, // order | tip | milestone | hourly | contest
    ref: { type: String, default: "" }, // order / contract id
    availableAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ["pending", "released", "reversed"], default: "pending", index: true },
    releasedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Clearance", clearanceSchema);
