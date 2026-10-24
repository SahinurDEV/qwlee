// Card refunds for orders whose escrow is returned to the buyer.
//
// Stripe: with STRIPE_SECRET_KEY set and an order paid through Stripe
// Checkout, the PaymentIntent behind the checkout session is refunded in
// full (idempotency key per order, so retries never double-refund).
// Anything else (demo payments, no key) records a "demo" refund so the
// flow is testable without a provider. Failures are recorded on the order
// (escrow.refund.status = "failed") for an admin to retry; they never
// block the cancellation itself.
const { Payment } = require("../models");
const logger = require("../config/logger");

async function stripeRefund(order, sessionId = order.sessionId, key = `qwlee-refund-${order._id}`, amount = null) {
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!pi) throw new Error("Checkout session has no payment intent");
  const refund = await stripe.refunds.create(
    { payment_intent: pi, reason: "requested_by_customer", metadata: { orderId: String(order._id) }, ...(amount != null ? { amount: Math.round(amount * 100) } : {}) },
    { idempotencyKey: key }
  );
  return { provider: "stripe", id: refund.id, status: refund.status === "failed" ? "failed" : refund.status === "succeeded" ? "succeeded" : "pending", amount: refund.amount / 100 };
}

/** Issue (or re-try) the money-back for an order. Safe to call repeatedly. */
async function issueRefund(orderOrId) {
  // Always reload: an ObjectId also has an `_id`, so a caller passing the
  // id must not be mistaken for an order document (that recorded $0
  // refunds and no session for Stripe).
  const order = await Payment.findById(orderOrId?._id ?? orderOrId);
  if (!order) return null;
  const prev = order.escrow?.refund;
  if (prev && (prev.status === "succeeded" || prev.status === "pending")) return prev;
  const isStripe = (order.escrow?.provider || order.provider) === "stripe" && !!process.env.STRIPE_SECRET_KEY && !String(order.sessionId || "").startsWith("demo");
  // Milestones already released to the seller are not refunded.
  const paid = Number(order.escrow?.amount ?? order.price ?? 0);
  const released = Number(order.escrow?.releasedGross || 0);
  // Nothing released yet: the buyer gets the service fee back too.
  const fee = released > 0 ? 0 : Number(order.escrow?.serviceFee || 0);
  const refundable = Math.max(0, Math.round((paid + fee - released) * 100) / 100);
  if (released > 0 && refundable === 0) {
    const none = { provider: "none", id: "", status: "succeeded", amount: 0, at: new Date() };
    await Payment.updateOne({ _id: order._id }, { $set: { "escrow.refund": none } });
    return none;
  }
  let result;
  try {
    result = isStripe
      ? await stripeRefund(order, order.sessionId, `qwlee-refund-${order._id}`, released > 0 ? refundable : null)
      : { provider: "demo", id: `demo_re_${order._id}`, status: "succeeded", amount: refundable };
  } catch (e) {
    logger.error(`Refund failed for order ${order._id}: ${e.message}`);
    result = { provider: isStripe ? "stripe" : "demo", id: prev?.id || "", status: "failed", error: String(e.message).slice(0, 300) };
  }
  result.at = new Date();
  await Payment.updateOne({ _id: order._id }, { $set: { "escrow.refund": result } });
  return result;
}

/**
 * Return one tip to the buyer: take the seller's net share back (their
 * balance may go negative, like Fiverr's "negative balance") and refund
 * the card through Stripe when the tip was paid there, else a demo refund.
 * The seller debit happens once; a failed card refund can be retried.
 */
async function refundTip(orderId, tipSessionId, reason = "") {
  const { User } = require("../models");
  const order = await Payment.findById(orderId);
  if (!order) return { error: "Order not found", code: 404 };
  const tip = (order.tips || []).find((t) => t.sessionId === tipSessionId);
  if (!tip) return { error: "Tip not found", code: 404 };
  // Mongoose gives an empty object for an unset nested path.
  const prev = tip.refund?.status ? tip.refund : null;
  if (prev && (prev.status === "succeeded" || prev.status === "pending")) return { error: "Tip already refunded", code: 409 };
  if (!prev) {
    // Claim atomically so two clicks can't debit the seller twice.
    const claimed = await Payment.updateOne(
      { _id: order._id, tips: { $elemMatch: { sessionId: tipSessionId, "refund.status": { $exists: false } } } },
      { $set: { "tips.$.refund": { status: "processing", at: new Date(), reason: String(reason).slice(0, 300) } } }
    );
    if (!claimed.modifiedCount) return { error: "Tip refund already in progress", code: 409 };
    await require("./clearance.service").debit(order.freelancerId, Number(tip.net || 0), { ref: order._id, source: "tip" });
  }
  const isStripe = tip.provider === "stripe" && !!process.env.STRIPE_SECRET_KEY && !String(tipSessionId).startsWith("demo");
  let result;
  try {
    result = isStripe
      ? await stripeRefund(order, tipSessionId, `qwlee-tip-refund-${order._id}-${tipSessionId}`)
      : { provider: "demo", id: `demo_re_tip_${tipSessionId}`, status: "succeeded", amount: Number(tip.amount || 0) };
  } catch (e) {
    logger.error(`Tip refund failed for order ${order._id}: ${e.message}`);
    result = { provider: isStripe ? "stripe" : "demo", id: "", status: "failed", error: String(e.message).slice(0, 300) };
  }
  result.at = new Date();
  result.reason = prev?.reason || String(reason).slice(0, 300);
  await Payment.updateOne({ _id: order._id, "tips.sessionId": tipSessionId }, { $set: { "tips.$.refund": result } });
  return { refund: result, sellerDebited: Number(tip.net || 0) };
}

module.exports = { issueRefund, refundTip };
