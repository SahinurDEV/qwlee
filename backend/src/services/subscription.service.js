// Monthly gig subscriptions. A seller opts a gig in, optionally with a
// discount of up to 30%. A buyer subscribes to one package; every month a
// normal order is created at the discounted price, so delivery, escrow and
// payout work exactly as for a one-off order.
//
// Payment: each cycle is charged through the demo provider when demo
// payments are on. Recurring card billing (Stripe Billing, off-session
// charges) is not implemented, so subscriptions are refused (503) when
// demo payments are off.
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");
const { Gig, Subscription } = require("../models");

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const addMonth = (d) => {
  const n = new Date(d);
  n.setMonth(n.getMonth() + 1);
  return n;
};
const oid = (id, what) => {
  if (!mongoose.isValidObjectId(String(id || ""))) throw new ApiError(httpStatus.BAD_REQUEST, `Invalid ${what} id`);
  return new mongoose.Types.ObjectId(String(id));
};

async function assertPayments() {
  const site = await require("./siteSettings.service").get();
  if (!site.marketplace.demoPayments) {
    throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "Subscriptions need recurring billing, which is only available with demo payments for now");
  }
}

async function setGigOption(userId, gigId, { enabled, discountPercent }) {
  const gig = await Gig.findOne({ _id: oid(gigId, "gig"), isDeleted: { $ne: true } });
  if (!gig || String(gig.userId) !== String(userId)) throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  const d = Number(discountPercent ?? gig.subscription?.discountPercent ?? 0);
  if (!Number.isFinite(d) || d < 0 || d > 30) throw new ApiError(httpStatus.BAD_REQUEST, "Discount must be 0-30%");
  gig.subscription = { enabled: !!enabled, discountPercent: Math.round(d) };
  await gig.save();
  return gig.subscription;
}

/** Price one cycle: the normal server-side quote, then the discount. */
async function quoteCycle(sub) {
  const orderLifecycle = require("./orderLifecycle.service");
  const quote = await orderLifecycle.quoteCheckout({ buyerId: String(sub.buyerId), gigId: String(sub.gigId), packageName: sub.packageName });
  const f = 1 - (Number(sub.discountPercent) || 0) / 100;
  quote.items = quote.items.map((i) => ({ ...i, price: round2(i.price * f) }));
  quote.total = round2(quote.items.reduce((n, i) => n + i.price * i.quantity, 0));
  quote.charge = quote.total;
  quote.data = { ...quote.data, subscriptionId: String(sub._id), packageName: `${quote.data.packageName} (monthly)` };
  return quote;
}

async function bill(sub, at = new Date()) {
  const orderLifecycle = require("./orderLifecycle.service");
  try {
    await assertPayments();
    const quote = await quoteCycle(sub);
    const order = await orderLifecycle.createOrderFromQuote(quote, { sessionId: `demo_sub_${sub._id}_${crypto.randomUUID()}`, provider: "demo" });
    sub.cycles.push({ at, orderId: order._id, amount: quote.total, status: "paid" });
    sub.price = quote.total;
    require("../controllers/orders.controller").notifyNewOrder(order).catch?.(() => {});
    return order;
  } catch (e) {
    // e.g. gig removed, seller away, payments off: record and try next month.
    sub.cycles.push({ at, amount: sub.price, status: "failed", error: String(e.message).slice(0, 200) });
    return null;
  } finally {
    sub.nextBillingAt = addMonth(sub.nextBillingAt > at ? sub.nextBillingAt : at);
    await sub.save();
  }
}

async function subscribe(buyerId, { gigId, packageName }) {
  await assertPayments();
  const gig = await Gig.findOne({ _id: oid(gigId, "gig"), isDeleted: { $ne: true }, gigStatus: "active" }).lean();
  if (!gig) throw new ApiError(httpStatus.NOT_FOUND, "Gig not available");
  if (!gig.subscription?.enabled) throw new ApiError(httpStatus.BAD_REQUEST, "This gig doesn't offer subscriptions");
  if (String(gig.userId) === String(buyerId)) throw new ApiError(httpStatus.BAD_REQUEST, "You cannot subscribe to your own gig");
  const pkg = (gig.package || []).find((p) => p.name === packageName);
  if (!pkg) throw new ApiError(httpStatus.BAD_REQUEST, "Unknown package");
  const dup = await Subscription.findOne({ buyerId, gigId: gig._id, packageName, status: { $ne: "cancelled" } });
  if (dup) throw new ApiError(httpStatus.CONFLICT, "You already subscribe to this package");
  const now = new Date();
  const sub = new Subscription({
    buyerId, sellerId: gig.userId, gigId: gig._id, packageName,
    discountPercent: gig.subscription.discountPercent || 0,
    price: round2(pkg.price * (1 - (gig.subscription.discountPercent || 0) / 100)),
    nextBillingAt: now,
  });
  // First month is charged now; it must succeed.
  const quote = await quoteCycle(sub);
  const order = await require("./orderLifecycle.service").createOrderFromQuote(quote, { sessionId: `demo_sub_${sub._id}_${crypto.randomUUID()}`, provider: "demo" });
  sub.cycles.push({ at: now, orderId: order._id, amount: quote.total, status: "paid" });
  sub.price = quote.total;
  sub.nextBillingAt = addMonth(now);
  await sub.save();
  require("../controllers/orders.controller").notifyNewOrder(order).catch?.(() => {});
  return { subscription: shape(sub.toObject()), orderId: String(order._id) };
}

function shape(s) {
  return {
    id: String(s._id),
    gig: s.gigId?.title ? { id: String(s.gigId._id), title: s.gigId.title, slug: s.gigId.slug } : { id: String(s.gigId) },
    buyer: s.buyerId?.username ? { id: String(s.buyerId._id), username: s.buyerId.username, fullName: s.buyerId.fullName } : undefined,
    seller: s.sellerId?.username ? { id: String(s.sellerId._id), username: s.sellerId.username, fullName: s.sellerId.fullName } : undefined,
    packageName: s.packageName,
    discountPercent: s.discountPercent,
    price: s.price,
    status: s.status,
    nextBillingAt: s.status === "active" ? s.nextBillingAt : null,
    cycles: (s.cycles || []).map((c) => ({ at: c.at, orderId: c.orderId ? String(c.orderId) : null, amount: c.amount, status: c.status, error: c.error })),
    createdAt: s.createdAt,
  };
}

async function list(userId, role = "buyer") {
  const q = role === "seller" ? { sellerId: userId } : { buyerId: userId };
  const rows = await Subscription.find(q).sort({ createdAt: -1 }).limit(200)
    .populate("gigId", "title slug").populate(role === "seller" ? "buyerId" : "sellerId", "username fullName").lean();
  return rows.map(shape);
}

async function act(userId, id, action) {
  const sub = await Subscription.findById(oid(id, "subscription"));
  const isBuyer = sub && String(sub.buyerId) === String(userId);
  const isSeller = sub && String(sub.sellerId) === String(userId);
  if (!isBuyer && !isSeller) throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
  if (sub.status === "cancelled") throw new ApiError(httpStatus.CONFLICT, "Subscription is cancelled");
  if (action === "cancel") {
    sub.status = "cancelled";
    sub.cancelledAt = new Date();
  } else if (action === "pause" && isBuyer && sub.status === "active") {
    sub.status = "paused";
  } else if (action === "resume" && isBuyer && sub.status === "paused") {
    sub.status = "active";
    // Resuming never back-charges skipped months.
    if (sub.nextBillingAt < new Date()) sub.nextBillingAt = new Date();
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, "Unknown or not allowed action");
  }
  await sub.save();
  return shape(sub.toObject());
}

/** Bill every active subscription that is due at `asOf`. */
async function billDue(asOf = new Date()) {
  const due = await Subscription.find({ status: "active", nextBillingAt: { $lte: asOf } }).limit(200);
  let paid = 0;
  let failed = 0;
  for (const sub of due) {
    const order = await bill(sub, asOf);
    if (order) paid++;
    else failed++;
  }
  if (due.length) logger.info(`subscriptions billed: ${paid} paid, ${failed} failed`);
  return { due: due.length, paid, failed };
}

module.exports = { setGigOption, subscribe, list, act, billDue };
