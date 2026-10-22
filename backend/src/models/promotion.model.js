const mongoose = require("mongoose");

// A paid boost for one gig: the seller pays from their balance and the gig
// shows as "Sponsored" above search results until endsAt.
const promotionSchema = new mongoose.Schema(
  {
    gigId: { type: mongoose.Schema.Types.ObjectId, ref: "Gig", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    days: { type: Number, required: true },
    cost: { type: Number, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true, index: true },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "cancelled"], default: "active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Promotion", promotionSchema);
