const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const withdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bankName: {
      type: String,
      // Only bank transfers need bank details.
      required: function () { return (this.method || "bank") === "bank"; },
    },
    accountNumber: {
      type: String,
      // Only bank transfers need bank details.
      required: function () { return (this.method || "bank") === "bank"; },
    },
    accountType: {
      type: String,
      // Only bank transfers need bank details.
      required: function () { return (this.method || "bank") === "bank"; },
    },
    withdrawalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Completed", "Failed"],
      default: "Pending",
    },
    cancelReason: { type: String, default: "" },
    // Payout method (see payouts.service).
    method: { type: String, enum: ["bank", "paypal", "payoneer"], default: "bank" },
    payoutAccount: { type: String, default: "" }, // PayPal email or Payoneer payee id
    payout: {
      provider: String, // paypal | payoneer | demo | manual
      id: String,
      status: String,
      error: String,
      at: Date,
    },
  },
  { timestamps: true }
);

withdrawalSchema.plugin(paginate);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
