// Job Success Score for a seller, from their closed orders and reviews.
// Scoring rules live in utils/jobSuccess.js.
const mongoose = require("mongoose");
const { score, badge } = require("../utils/jobSuccess");

async function forSeller(userId) {
  const oid = new mongoose.Types.ObjectId(String(userId));
  const Payment = mongoose.model("Payment");
  const Review = mongoose.model("Review");
  const since = new Date(Date.now() - 24 * 30.44 * 864e5);
  const orders = await Payment.find(
    { freelancerId: oid, isDeleted: { $ne: true }, status: { $in: ["delivered", "cancelled"] }, $or: [{ completedAt: { $gte: since } }, { cancelledAt: { $gte: since } }, { updatedAt: { $gte: since } }] },
    "status completedAt cancelledAt updatedAt"
  ).lean();
  const reviews = await Review.find({ freelancerId: oid, orderId: { $in: orders.map((o) => o._id) } }, "orderId rating").lean();
  const rating = new Map(reviews.map((r) => [String(r.orderId), r.rating]));
  const rows = orders.map((o) => ({
    status: o.status,
    rating: rating.get(String(o._id)),
    closedAt: o.status === "delivered" ? o.completedAt || o.updatedAt : o.cancelledAt || o.updatedAt,
  }));
  const s = score(rows);
  return { ...s, badge: badge(s.score) };
}

module.exports = { forSeller };
