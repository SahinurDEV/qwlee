// Fiverr-style order lifecycle: server-side pricing, escrow, requirements,
// delivery, revisions, acceptance and auto-completion.
//
// Money model (escrow): when an order is paid the full amount is held on
// the order (`escrow.status = "held"`). It is released to the seller's
// balance (minus the platform fee) exactly once, when the buyer accepts
// or the order auto-completes. Cancelling an unreleased order marks the
// escrow refunded. Legacy orders without an `escrow` block are treated as
// held while open.
//
// Status names stay backward compatible with the existing apps:
//   active / late   in progress (`delivery.state` says whether work was
//                   submitted and is awaiting the buyer)
//   delivered       buyer accepted (completed); seller paid
//   cancelled       cancelled; escrow refunded
//   disputed        frozen while a dispute is open

const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");
const { Payment, Gig, User } = require("../models");
const Message = require("../models/message.model");
const appConfigService = require("./appConfig.service");
const { isAway } = require("../utils/availability");

const AUTO_COMPLETE_DAYS = Number(process.env.AUTO_COMPLETE_DAYS) || 3;
const OPEN = ["active", "late"];
// Admin setting (Settings > Marketplace) with the env value as default.
const autoCompleteDays = async () => {
  try {
    return (await require("./siteSettings.service").get()).marketplace.autoCompleteDays || AUTO_COMPLETE_DAYS;
  } catch {
    return AUTO_COMPLETE_DAYS;
  }
};
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// "3 revisions" / "Unlimited revisions" in a package's feature list.
const revisionsFromPackage = (pkg) => {
  if (Number.isFinite(Number(pkg?.revisions)) && pkg?.revisions !== "") return Number(pkg.revisions);
  const text = (pkg?.features || []).map((f) => (typeof f === "string" ? f : f?.feature || "")).join(" ");
  if (/unlimited revision/i.test(text)) return 99;
  const m = text.match(/(\d+)\s*revision/i);
  return m ? Number(m[1]) : 1;
};

const idOf = (v) => String(v?._id || v?.id || v || "");

/**
 * Work out what the buyer must pay. Prices always come from the database
 * (gig package + extras, or the seller's custom offer), never the client.
 */
const quoteCheckout = async (args) => {
  const quote = await priceCheckout(args);
  // Coupon: the buyer is charged `charge`; the platform funds the rest.
  quote.charge = quote.total;
  quote.discount = 0;
  if (args.couponCode) {
    const c = await require("./coupon.service").evaluate(args.couponCode, args.buyerId, quote.total);
    quote.couponCode = c.code;
    quote.discount = c.discount;
    quote.couponDescription = c.description;
    quote.charge = round2(quote.total - c.discount);
  }
  // Vacation mode: no new orders while the seller is away.
  const seller = await User.findById(quote.freelancerId).select("availability");
  if (isAway(seller)) {
    const until = seller.availability.until ? ` until ${new Date(seller.availability.until).toISOString().slice(0, 10)}` : "";
    throw new ApiError(httpStatus.CONFLICT, `This seller is unavailable${until} and is not taking new orders`);
  }
  return quote;
};

const priceCheckout = async ({ buyerId, gigId, packageName, extraIds = [], messageId, requestOfferId }) => {
  if (requestOfferId) {
    const { offer, request, gig } = await require("./buyerRequest.service").quoteRequestOffer(requestOfferId, buyerId);
    const title = request.title;
    return {
      kind: "request",
      freelancerId: idOf(offer.sellerId),
      clientId: String(buyerId),
      gigId: gig ? String(gig._id) : undefined,
      requestOfferId: String(offer._id),
      title,
      items: [{ name: `Request: ${title}`, price: round2(offer.price), quantity: 1 }],
      total: round2(offer.price),
      deliveryDays: offer.deliveryDays,
      data: {
        title,
        packageName: "Request offer",
        package: { name: "Request offer", price: offer.price, deliveryDate: offer.deliveryDays, features: [offer.message] },
        extras: [],
        requestId: String(request._id),
        requirementQuestions: [],
        requirements: null,
        requirementAnswers: [{ question: "Buyer request", answer: `${request.title}\n\n${request.description}` }],
        revisionsLeft: offer.revisions,
        deliveryDays: offer.deliveryDays,
      },
    };
  }
  if (messageId) {
    const msg = await Message.findById(messageId);
    const offer = msg?.content?.offerDetails;
    if (!msg || !offer || offer.price == null) throw new ApiError(httpStatus.NOT_FOUND, "Offer not found");
    if (idOf(msg.receiver) !== String(buyerId)) throw new ApiError(httpStatus.FORBIDDEN, "This offer is not addressed to you");
    if (offer.status && offer.status !== "pending") throw new ApiError(httpStatus.CONFLICT, `Offer is already ${offer.status}`);
    const gig = offer.gigId ? await Gig.findById(offer.gigId) : null;
    // Offers store either a number of days or an absolute date.
    let deliveryDays = 7;
    const dt = offer.deliveryTime ? new Date(offer.deliveryTime) : null;
    if (dt && !Number.isNaN(dt.getTime())) {
      deliveryDays = Math.max(1, Math.ceil((dt.getTime() - Date.now()) / 86400000));
    }
    const revisions = Number.parseInt(offer.revisionDays, 10);
    return {
      kind: "offer",
      freelancerId: idOf(msg.sender),
      clientId: String(buyerId),
      gigId: gig ? String(gig._id) : undefined,
      messageId: String(msg._id),
      title: offer.gigTitle || gig?.title || "Custom offer",
      items: [{ name: offer.gigTitle || gig?.title || "Custom offer", price: round2(offer.price), quantity: 1 }],
      total: round2(offer.price),
      deliveryDays,
      data: {
        title: offer.gigTitle || gig?.title,
        packageName: "Custom offer",
        package: { name: "Custom offer", price: offer.price, deliveryDate: deliveryDays, features: [offer.description].filter(Boolean) },
        extras: [],
        requirementQuestions: gig?.requirementQuestions || [],
        requirements: null,
        revisionsLeft: Number.isFinite(revisions) ? revisions : 1,
        deliveryDays,
        ...(offer.milestones?.length ? { milestones: require("./milestones.service").forOrder(offer.milestones) } : {}),
      },
    };
  }

  const gig = await Gig.findById(gigId);
  if (!gig || gig.isDeleted || gig.gigStatus !== "active") throw new ApiError(httpStatus.NOT_FOUND, "Gig not available");
  if (idOf(gig.userId) === String(buyerId)) throw new ApiError(httpStatus.BAD_REQUEST, "You cannot buy your own gig");
  const packages = gig.package || [];
  const pkg = packages.find((p) => p?.name === packageName) || (packageName ? null : packages[0]);
  if (!pkg) throw new ApiError(httpStatus.BAD_REQUEST, "Unknown package");

  const wanted = new Set((extraIds || []).map(String));
  const extras = (gig.extras || []).filter((e) => wanted.has(String(e._id)));
  if (extras.length !== wanted.size) throw new ApiError(httpStatus.BAD_REQUEST, "Unknown gig extra");

  const deliveryDays = Number(pkg.deliveryDate || 7) + extras.reduce((n, e) => n + Number(e.deliveryDays || 0), 0);
  const items = [
    { name: `${gig.title} (${pkg.name})`, price: round2(pkg.price), quantity: 1 },
    ...extras.map((e) => ({ name: `Extra: ${e.title}`, price: round2(e.price), quantity: 1 })),
  ];
  const total = round2(items.reduce((n, i) => n + i.price * i.quantity, 0));
  return {
    kind: "gig",
    freelancerId: idOf(gig.userId),
    clientId: String(buyerId),
    gigId: String(gig._id),
    title: gig.title,
    packageName: pkg.name,
    extraIds: extras.map((e) => String(e._id)),
    items,
    total,
    deliveryDays,
    data: {
      title: gig.title,
      packageName: pkg.name,
      package: pkg,
      extras: extras.map((e) => ({ id: String(e._id), title: e.title, price: e.price, deliveryDays: e.deliveryDays || 0 })),
      requirementQuestions: gig.requirementQuestions || [],
      requirements: null,
      revisionsLeft: revisionsFromPackage(pkg),
      deliveryDays,
    },
  };
};

/** Create the order once payment is confirmed. Idempotent on sessionId. */
const createOrderFromQuote = async (quote, { sessionId, provider }) => {
  const existing = await Payment.findOne({ sessionId });
  if (existing) return existing;
  const needsRequirements = (quote.data.requirementQuestions || []).length > 0;
  const order = await Payment.create({
    sessionId,
    items: quote.items.map((i) => ({ ...i, freelancerId: quote.freelancerId })),
    messageId: quote.messageId || "",
    freelancerId: quote.freelancerId,
    clientId: quote.clientId,
    gigId: quote.gigId,
    price: quote.total,
    data: quote.data,
    status: "active",
    deliveryDate: new Date(Date.now() + quote.deliveryDays * 86400000),
    // escrow.amount is what the buyer paid; platformFunded tops it up
    // to the full price for the seller's payout.
    escrow: { status: "held", amount: quote.charge ?? quote.total, platformFunded: quote.discount || 0, provider, heldAt: new Date() },
    ...(quote.couponCode ? { coupon: { code: quote.couponCode, discount: quote.discount } } : {}),
    requirementsStatus: needsRequirements ? "pending" : "not_required",
  });
  if (quote.couponCode) {
    await require("./coupon.service").redeem(quote.couponCode, quote.clientId, order._id, quote.discount);
  }
  if (quote.requestOfferId) {
    await require("./buyerRequest.service").markOfferHired(quote.requestOfferId, order._id);
  }
  if (quote.messageId) {
    await Message.updateOne(
      { _id: quote.messageId },
      { $set: { "content.offerDetails.status": "accepted", "content.offerDetails.orderId": order._id } }
    );
  }
  return order;
};

const loadParty = async (orderId, userId) => {
  const order = await Payment.findById(orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  const isBuyer = String(order.clientId) === String(userId);
  const isSeller = String(order.freelancerId) === String(userId);
  if (!isBuyer && !isSeller) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  return { order, isBuyer, isSeller };
};

/**
 * Release escrow to the seller exactly once. Uses an atomic status swap so
 * concurrent accept / auto-complete calls cannot double-credit.
 */
const completeOrder = async (order, { reason = "accepted", fromStatuses = OPEN } = {}) => {
  const feePercent = await appConfigService.getPlatformFeePercent(order.gigId, { clientId: order.clientId });
  const gross = Number(order.escrow?.amount ?? order.price ?? order.items?.[0]?.price ?? 0) + Number(order.escrow?.platformFunded || 0);
  // Milestones already released were paid out (and charged their fee) then.
  const done = { gross: Number(order.escrow?.releasedGross || 0), fee: Number(order.escrow?.releasedFee || 0), net: Number(order.escrow?.releasedNet || 0) };
  const rest = Math.max(0, round2(gross - done.gross));
  const fee = round2((rest * feePercent) / 100);
  const net = round2(rest - fee);
  const milestoneSet = {};
  (order.data?.milestones || []).forEach((m, i) => {
    if (m.status === "pending") {
      milestoneSet[`data.milestones.${i}.status`] = "released";
      milestoneSet[`data.milestones.${i}.releasedAt`] = new Date();
    }
  });
  const swapped = await Payment.findOneAndUpdate(
    { _id: order._id, status: { $in: fromStatuses }, "escrow.status": { $nin: ["released", "refunded"] } },
    {
      $set: {
        status: "delivered",
        completedAt: new Date(),
        completionReason: reason,
        "delivery.state": "accepted",
        "escrow.status": "released",
        "escrow.releasedAt": new Date(),
        platformFeePercent: feePercent,
        platformFee: round2(fee + done.fee),
        sellerEarning: round2(net + done.net),
        ...milestoneSet,
      },
    },
    { new: true }
  );
  if (!swapped) throw new ApiError(httpStatus.CONFLICT, "Order cannot be completed in its current state");
  await User.updateOne({ _id: order.freelancerId }, { $inc: { balance: net } });
  require("./referral.service").onOrderCompleted(swapped).catch(() => {});
  require("./gigStats.service").recomputeLater(swapped.gigId);
  return swapped;
};

/** Mark escrow refunded when an unreleased order is cancelled. */
const TIP_WINDOW_DAYS = 30;

/** Validate a tip (Fiverr rules: $5 min; up to $25 on orders under $25, else up to 100%). */
const quoteTip = async (orderId, buyerId, amount) => {
  const order = await Payment.findById(orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  if (idOf(order.clientId) !== String(buyerId)) throw new ApiError(httpStatus.FORBIDDEN, "Only the buyer can tip");
  if (order.status !== "delivered" || order.escrow?.status !== "released") {
    throw new ApiError(httpStatus.BAD_REQUEST, "You can tip once the order is completed");
  }
  const doneAt = order.completedAt || order.updatedAt;
  if (Date.now() - new Date(doneAt).getTime() > TIP_WINDOW_DAYS * 86400000) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Tips are possible for ${TIP_WINDOW_DAYS} days after completion`);
  }
  const value = round2(amount);
  const max = order.price < 25 ? 25 : round2(order.price);
  if (!(value >= 5 && value <= max)) throw new ApiError(httpStatus.BAD_REQUEST, `Tip must be between $5 and $${max}`);
  return { order, amount: value };
};

/** Credit a paid tip to the seller (net of platform fee). Idempotent on sessionId. */
const recordTip = async (orderId, amount, { provider, sessionId }) => {
  const tipped = await Payment.findById(orderId, "gigId clientId").lean();
  const feePercent = await appConfigService.getPlatformFeePercent(tipped?.gigId, { clientId: tipped?.clientId });
  const fee = round2((amount * feePercent) / 100);
  const net = round2(amount - fee);
  const updated = await Payment.findOneAndUpdate(
    { _id: orderId, "tips.sessionId": { $ne: sessionId } },
    { $push: { tips: { amount, fee, net, provider, sessionId, at: new Date() } } },
    { new: true }
  );
  if (!updated) return null;
  await User.updateOne({ _id: updated.freelancerId }, { $inc: { balance: net } });
  return updated;
};

const refundEscrow = async (orderId) => {
  const r = await Payment.updateOne(
    { _id: orderId, "escrow.status": { $nin: ["released", "refunded"] } },
    { $set: { "escrow.status": "refunded", "escrow.refundedAt": new Date() } }
  );
  // Return the buyer's money through the payment provider (or demo).
  if (r.modifiedCount) await require("./refunds.service").issueRefund(orderId);
};

const submitRequirements = async (orderId, userId, answers) => {
  const { order, isBuyer } = await loadParty(orderId, userId);
  if (!isBuyer) throw new ApiError(httpStatus.FORBIDDEN, "Only the buyer submits requirements");
  if (!OPEN.includes(order.status)) throw new ApiError(httpStatus.CONFLICT, "Order is closed");
  if (order.requirementsStatus === "submitted") throw new ApiError(httpStatus.CONFLICT, "Requirements already submitted");
  const questions = order.data?.requirementQuestions || [];
  const clean = (Array.isArray(answers) ? answers : []).map((a) => ({
    question: String(a?.question || "").slice(0, 500),
    answer: String(a?.answer || "").slice(0, 5000),
  }));
  questions.forEach((q, i) => {
    if (q.required && !clean[i]?.answer?.trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Answer required: ${q.question}`);
    }
  });
  const days = Number(order.data?.deliveryDays || 7);
  order.data = { ...order.data, requirementAnswers: clean };
  order.markModified("data");
  order.requirementsStatus = "submitted";
  order.requirementsSubmittedAt = new Date();
  // Fiverr starts the delivery clock when requirements arrive.
  order.deliveryDate = new Date(Date.now() + days * 86400000);
  await order.save();
  return order;
};

/** Called when the seller posts a delivery in the order chat. */
const recordDelivery = async (orderId, userId) => {
  const { order, isSeller } = await loadParty(orderId, userId);
  if (!isSeller) throw new ApiError(httpStatus.FORBIDDEN, "Only the seller can deliver");
  if (!OPEN.includes(order.status)) throw new ApiError(httpStatus.CONFLICT, `Order is ${order.status}`);
  const now = new Date();
  order.delivery = {
    state: "submitted",
    count: (order.delivery?.count || 0) + 1,
    lastDeliveredAt: now,
    autoCompleteAt: new Date(now.getTime() + (await autoCompleteDays()) * 86400000),
  };
  await order.save();
  return order;
};

const requestRevision = async (orderId, userId, reason) => {
  const { order, isBuyer } = await loadParty(orderId, userId);
  if (!isBuyer) throw new ApiError(httpStatus.FORBIDDEN, "Only the buyer can request a revision");
  if (!OPEN.includes(order.status) || order.delivery?.state !== "submitted") {
    throw new ApiError(httpStatus.CONFLICT, "There is no delivery to revise");
  }
  const left = Number(order.data?.revisionsLeft ?? 0);
  if (left <= 0) throw new ApiError(httpStatus.BAD_REQUEST, "No revisions left on this order");
  order.data = { ...order.data, revisionsLeft: left - 1 };
  order.markModified("data");
  order.delivery = { ...(order.delivery?.toObject?.() || order.delivery), state: "revision", autoCompleteAt: null };
  order.revisions = [...(order.revisions || []), { reason: String(reason || "").slice(0, 2000), requestedAt: new Date() }];
  await order.save();
  return order;
};

const acceptDelivery = async (orderId, userId) => {
  const { order, isBuyer } = await loadParty(orderId, userId);
  if (!isBuyer) throw new ApiError(httpStatus.FORBIDDEN, "Only the buyer can accept");
  return completeOrder(order, { reason: "accepted" });
};

/**
 * Background housekeeping, run on an interval:
 *  - auto-complete deliveries the buyer ignored for AUTO_COMPLETE_DAYS
 *  - flag in-progress orders past their deadline as late
 */
const runHousekeeping = async ({ trigger = "timer" } = {}) => {
  const { track } = require("./jobs.service");
  const now = new Date();
  const autoCompleted = await track("autoComplete", async () => {
    const due = await Payment.find({ status: { $in: OPEN }, "delivery.state": "submitted", "delivery.autoCompleteAt": { $lte: now } }).limit(100);
    for (const order of due) {
      try {
        await completeOrder(order, { reason: "auto" });
      } catch (e) {
        logger.warn(`auto-complete ${order._id} skipped: ${e.message}`);
      }
    }
    return due.length;
  }, trigger);
  await track("sellerPlans", () => require("./sellerPlan.service").renewDue(now), trigger);
  const markedLate = await track("markLate", async () => {
    const late = await Payment.updateMany(
      { status: "active", deliveryDate: { $lt: now }, "delivery.state": { $ne: "submitted" }, requirementsStatus: { $ne: "pending" } },
      { $set: { status: "late" } }
    );
    return late.modifiedCount || 0;
  }, trigger);
  const autoCancelled = await track("autoCancel", () => require("./cancellation.service").autoAcceptExpired(), trigger);
  const subscriptions = await track("subscriptions", () => require("./subscription.service").billDue(), trigger);
  const announcements = await track("announcements", () => require("./announcements.service").sendDue(), trigger);
  const bansLifted = await track("bansLifted", () => require("./moderation.service").liftExpiredBans(), trigger);
  const kpiEmail = await track("kpiEmail", () => require("./kpi.service").maybeSendWeekly(), trigger);
  return { kpiEmail, autoCompleted, markedLate, autoCancelled, subscriptions, bansLifted, announcements };
};

let timer = null;
const startHousekeeping = (intervalMs = Number(process.env.ORDER_HOUSEKEEPING_MS) || 10 * 60 * 1000) => {
  if (timer) return;
  timer = setInterval(() => runHousekeeping().catch((e) => logger.warn(`order housekeeping: ${e.message}`)), intervalMs);
  timer.unref?.();
};

module.exports = {
  quoteTip,
  recordTip,
  quoteCheckout,
  createOrderFromQuote,
  completeOrder,
  refundEscrow,
  submitRequirements,
  recordDelivery,
  requestRevision,
  acceptDelivery,
  runHousekeeping,
  startHousekeeping,
  revisionsFromPackage,
};
