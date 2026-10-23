// Contest (Freelancer.com / 99designs-style): a buyer funds a prize up
// front, sellers submit entries until the deadline, the buyer picks a
// winner, the winner hands over the final files and gets the prize.
const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

const entrySchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true, maxlength: 2000 },
    links: { type: [String], default: [] },
    status: { type: String, enum: ["active", "withdrawn", "winner"], default: "active" },
  },
  { timestamps: true }
);

const contestSchema = new mongoose.Schema(
  {
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    brief: { type: String, required: true, maxlength: 5000 },
    categoriesId: { type: mongoose.Schema.Types.ObjectId, ref: "Categories", default: null },
    prize: { type: Number, required: true, min: 20 },
    deadline: { type: Date, required: true, index: true },
    // Entries hidden from other sellers (only the buyer sees them).
    sealed: { type: Boolean, default: false },
    // open → judging (deadline passed) → handover (winner picked) → completed;
    // or cancelled (refunded).
    status: { type: String, enum: ["open", "judging", "handover", "completed", "cancelled"], default: "open", index: true },
    entries: { type: [entrySchema], default: [] },
    winnerEntryId: { type: mongoose.Schema.Types.ObjectId, default: null },
    handover: {
      note: { type: String, default: "" },
      links: { type: [String], default: [] },
      submittedAt: { type: Date, default: null },
    },
    payout: { feePercent: Number, fee: Number, net: Number, paidAt: Date },
  },
  { timestamps: true }
);
contestSchema.plugin(toJSON);
contestSchema.plugin(paginate);

module.exports = mongoose.model("Contest", contestSchema);
