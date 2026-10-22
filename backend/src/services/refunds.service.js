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

async function stripeRefund(order) {
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.retrieve(order.sessionId);
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!pi) throw new Error("Checkout session has no payment intent");
  const refund = await stripe.refunds.create(
    { payment_intent: pi, reason: "requested_by_customer", metadata: { orderId: String(order._id) } },
    { idempotencyKey: `qwlee-refund-${order._id}` }
  );
  return { provider: "stripe", id: refund.id, status: refund.status === "failed" ? "failed" : refund.status === "succeeded" ? "succeeded" : "pending", amount: refund.amount / 100 };
}

/** Issue (or re-try) the money-back for an order. Safe to call repeatedly. */
async function issueRefund(orderOrId) {
  const order = orderOrId?._id ? orderOrId : await Payment.findById(orderOrId);
  if (!order) return null;
  const prev = order.escrow?.refund;
  if (prev && (prev.status === "succeeded" || prev.status === "pending")) return prev;
  const isStripe = (order.escrow?.provider || order.provider) === "stripe" && !!process.env.STRIPE_SECRET_KEY && !String(order.sessionId || "").startsWith("demo");
  let result;
  try {
    result = isStripe
      ? await stripeRefund(order)
      : { provider: "demo", id: `demo_re_${order._id}`, status: "succeeded", amount: Number(order.escrow?.amount ?? order.price ?? 0) };
  } catch (e) {
    logger.error(`Refund failed for order ${order._id}: ${e.message}`);
    result = { provider: isStripe ? "stripe" : "demo", id: prev?.id || "", status: "failed", error: String(e.message).slice(0, 300) };
  }
  result.at = new Date();
  await Payment.updateOne({ _id: order._id }, { $set: { "escrow.refund": result } });
  return result;
}

module.exports = { issueRefund };
