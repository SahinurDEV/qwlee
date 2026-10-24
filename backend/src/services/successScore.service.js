// Success Score per seller and per gig. Formula: utils/successScore.js.
const mongoose = require("mongoose");
const { score, DEFAULT_WEIGHTS } = require("../utils/successScore");

async function settings() {
  const m = (await require("./siteSettings.service").get()).marketplace;
  return {
    windowDays: Number(m.successScoreDays) || 90,
    minOrders: Number(m.successScoreMinOrders ?? 5),
    weights: { ...DEFAULT_WEIGHTS, ...(m.successScoreWeights || {}) },
  };
}

async function rowsFor(match, windowDays) {
  const Payment = mongoose.model("Payment");
  const since = new Date(Date.now() - windowDays * 864e5);
  const orders = await Payment.find(
    { ...match, isDeleted: { $ne: true }, status: { $in: ["delivered", "cancelled"] }, $or: [{ completedAt: { $gte: since } }, { cancelledAt: { $gte: since } }] },
    "status gigId deliveryDate delivery.lastDeliveredAt"
  ).lean();
  const ids = orders.map((o) => o._id);
  const [reviews, disputes] = await Promise.all([
    mongoose.model("Review").find({ orderId: { $in: ids } }, "orderId rating privateRating").lean(),
    mongoose.model("Dispute").find({ orderId: { $in: ids } }, "orderId").lean(),
  ]);
  const rev = new Map(reviews.map((r) => [String(r.orderId), r]));
  const dis = new Set(disputes.map((d) => String(d.orderId)));
  return orders.map((o) => {
    const r = rev.get(String(o._id));
    const at = o.delivery?.lastDeliveredAt;
    return {
      gigId: String(o.gigId || ""),
      status: o.status,
      rating: r?.rating,
      privateRating: r?.privateRating,
      onTime: at && o.deliveryDate ? new Date(at) <= new Date(o.deliveryDate) : undefined,
      disputed: dis.has(String(o._id)),
    };
  });
}

async function forSeller(userId) {
  const s = await settings();
  const rows = await rowsFor({ freelancerId: new mongoose.Types.ObjectId(String(userId)) }, s.windowDays);
  return { ...score(rows, s), windowDays: s.windowDays };
}

/** Map gigId -> score for all of a seller's gigs. */
async function forSellerGigs(userId) {
  const s = await settings();
  const rows = await rowsFor({ freelancerId: new mongoose.Types.ObjectId(String(userId)) }, s.windowDays);
  const by = new Map();
  for (const r of rows) by.set(r.gigId, [...(by.get(r.gigId) || []), r]);
  const out = new Map();
  for (const [g, list] of by) out.set(g, { ...score(list, s), windowDays: s.windowDays });
  return out;
}

async function forGig(gigId) {
  const s = await settings();
  const rows = await rowsFor({ gigId: new mongoose.Types.ObjectId(String(gigId)) }, s.windowDays);
  return { ...score(rows, s), windowDays: s.windowDays };
}

module.exports = { forSeller, forSellerGigs, forGig };
