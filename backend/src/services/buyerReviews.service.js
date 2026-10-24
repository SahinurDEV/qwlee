// Seller -> buyer reviews, double-blind (see models/buyerReview.model.js).
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { BuyerReview, Payment, Reviews, User } = require("../models");
const { PUBLIC_USER_SELECT, toPublicUser } = require("../utils/publicUser");

const idOf = (v) => String(v?._id || v || "");
const windowDays = async () => (await require("./siteSettings.service").get()).marketplace.reviewWindowDays || 0;
const doneAt = (o) => new Date(o.completedAt || o.updatedAt).getTime();

async function create(orderId, sellerId, { rating, review } = {}) {
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) throw new ApiError(httpStatus.BAD_REQUEST, "rating must be 1-5");
  const order = await Payment.findById(orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  if (idOf(order.freelancerId) !== String(sellerId)) throw new ApiError(httpStatus.FORBIDDEN, "Only the seller on this order can review the buyer");
  if (order.status !== "delivered") throw new ApiError(httpStatus.BAD_REQUEST, "You can review the buyer once the order is completed");
  const days = await windowDays();
  if (days && Date.now() > doneAt(order) + days * 86400000) throw new ApiError(httpStatus.BAD_REQUEST, `Reviews can be left up to ${days} days after an order is completed.`);
  if (await BuyerReview.exists({ orderId })) throw new ApiError(httpStatus.BAD_REQUEST, "You already reviewed this buyer");
  const buyerReviewed = await Reviews.exists({ orderId });
  const doc = await BuyerReview.create({
    orderId, sellerId, buyerId: order.clientId, rating: r, review: String(review || "").trim().slice(0, 2000),
    publishedAt: buyerReviewed ? new Date() : null,
  });
  return doc;
}

/** Publish pending seller reviews once the buyer reviewed or the window ended. */
async function publishDue(now = new Date()) {
  const pending = await BuyerReview.find({ publishedAt: null }).limit(200);
  const days = await windowDays();
  let n = 0;
  for (const b of pending) {
    const order = await Payment.findById(b.orderId).select("completedAt updatedAt").lean();
    const closed = !order || (days && now.getTime() > doneAt(order) + days * 86400000);
    if (closed || (await Reviews.exists({ orderId: b.orderId }))) {
      await BuyerReview.updateOne({ _id: b._id, publishedAt: null }, { $set: { publishedAt: now } });
      n++;
    }
  }
  return n;
}

/** For the order page: the seller always sees theirs; the buyer once published. */
async function forOrder(orderId, userId) {
  await publishDue();
  const b = await BuyerReview.findOne({ orderId }).lean();
  if (!b) return null;
  if (idOf(b.sellerId) === String(userId)) return b;
  if (idOf(b.buyerId) === String(userId)) return b.publishedAt ? b : { pending: true };
  return null;
}

/** Public list of published reviews a buyer received. */
async function listForBuyer(buyerId, limit = 20) {
  const rows = await BuyerReview.find({ buyerId, publishedAt: { $ne: null } }).sort({ publishedAt: -1 }).limit(Math.min(50, Number(limit) || 20)).populate({ path: "sellerId", select: PUBLIC_USER_SELECT }).lean();
  const avg = rows.length ? Math.round((rows.reduce((a, r) => a + r.rating, 0) / rows.length) * 10) / 10 : null;
  return { average: avg, count: rows.length, results: rows.map((r) => ({ ...r, id: String(r._id), sellerId: toPublicUser(r.sellerId) })) };
}

module.exports = { create, publishDue, forOrder, listForBuyer };
