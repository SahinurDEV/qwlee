// Hourly contract (Upwork-style): the buyer hires a seller at an hourly
// rate with a weekly hour limit; the seller logs time; each finished week
// becomes an invoice the buyer can review before it is paid.
const mongoose = require("mongoose");
const { toJSON } = require("./plugins");

const entrySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    weekStart: { type: Date, required: true, index: true },
    hours: { type: Number, required: true, min: 0.25, max: 24 },
    memo: { type: String, default: "" },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    weekStart: { type: Date, required: true },
    hours: { type: Number, required: true },
    amount: { type: Number, required: true },
    // review → paid, or disputed (buyer) / unpaid (buyer balance too low)
    status: { type: String, enum: ["review", "paid", "disputed", "unpaid"], default: "review" },
    reviewUntil: { type: Date, required: true },
    disputeReason: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    feePercent: { type: Number, default: null },
    fee: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const hourlyContractSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 4000 },
    rate: { type: Number, required: true, min: 3, max: 999 },
    weeklyLimit: { type: Number, required: true, min: 1, max: 80 },
    status: { type: String, enum: ["offered", "active", "paused", "ended", "declined"], default: "offered", index: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    entries: { type: [entrySchema], default: [] },
    invoices: { type: [invoiceSchema], default: [] },
  },
  { timestamps: true }
);
hourlyContractSchema.plugin(toJSON);

module.exports = mongoose.model("HourlyContract", hourlyContractSchema);
