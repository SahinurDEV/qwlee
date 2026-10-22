// Mutual cancellation (Fiverr's "Resolution Center → cancel order").
// Either party asks with a reason; the other accepts (order cancelled,
// escrow refunded) or declines. The requester can withdraw. An
// unanswered request is accepted automatically after RESPONSE_HOURS.
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { Payment } = require("../models");
const logger = require("../config/logger");

const RESPONSE_HOURS = Number(process.env.CANCEL_RESPONSE_HOURS) || 48;
const OPEN = ["active", "late"];
const idOf = (v) => String(v?._id || v || "");

async function notify(userId, role, message) {
  try {
    await require("./notification.service").addCustomNotification(`${role}-notification`, userId, {
      receiverId: userId, message, role, type: "order", viewStatus: false,
    });
  } catch { /* best effort */ }
}

async function load(orderId, userId) {
  const order = await Payment.findById(orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  const isBuyer = idOf(order.clientId) === String(userId);
  const isSeller = idOf(order.freelancerId) === String(userId);
  if (!isBuyer && !isSeller) throw new ApiError(httpStatus.FORBIDDEN, "You are not a party to this order");
  return { order, isBuyer, isSeller };
}

async function request(orderId, userId, reason) {
  const { order, isBuyer } = await load(orderId, userId);
  if (!OPEN.includes(order.status)) throw new ApiError(httpStatus.CONFLICT, `Order is ${order.status}`);
  const text = String(reason || "").trim();
  if (text.length < 5) throw new ApiError(httpStatus.BAD_REQUEST, "Tell the other side why (at least 5 characters)");
  const r = await Payment.updateOne(
    { _id: order._id, status: { $in: OPEN }, "cancellationRequest.status": { $ne: "pending" } },
    { $set: { cancellationRequest: { status: "pending", by: userId, byRole: isBuyer ? "buyer" : "seller", reason: text.slice(0, 1000), requestedAt: new Date(), respondBy: new Date(Date.now() + RESPONSE_HOURS * 3600e3) } } }
  );
  if (!r.modifiedCount) throw new ApiError(httpStatus.CONFLICT, "A cancellation request is already open");
  await notify(isBuyer ? order.freelancerId : order.clientId, isBuyer ? "freelancer" : "buyer",
    `${isBuyer ? "The buyer" : "The seller"} asked to cancel an order. Respond within ${RESPONSE_HOURS} hours or it is cancelled automatically.`);
  return Payment.findById(order._id);
}

async function accept(order, byUserId, auto = false) {
  const claimed = await Payment.updateOne(
    { _id: order._id, "cancellationRequest.status": "pending", status: { $in: OPEN } },
    { $set: { "cancellationRequest.status": auto ? "auto-accepted" : "accepted", "cancellationRequest.respondedAt": new Date() } }
  );
  if (!claimed.modifiedCount) throw new ApiError(httpStatus.CONFLICT, "No open cancellation request");
  const fresh = await Payment.findById(order._id);
  const reason = `Mutual cancellation: ${fresh.cancellationRequest.reason}`;
  // Same path as a seller-initiated cancel (status swap, refund, emails).
  await require("./orders.service").orderModify(order._id, { status: "cancelled", reason }, idOf(byUserId || fresh.freelancerId), { mutual: true });
  return Payment.findById(order._id);
}

async function respond(orderId, userId, action) {
  const { order, isBuyer } = await load(orderId, userId);
  const cr = order.cancellationRequest || {};
  if (cr.status !== "pending") throw new ApiError(httpStatus.CONFLICT, "No open cancellation request");
  const mine = idOf(cr.by) === String(userId);
  if (action === "withdraw") {
    if (!mine) throw new ApiError(httpStatus.FORBIDDEN, "Only the requester can withdraw");
    await Payment.updateOne({ _id: order._id, "cancellationRequest.status": "pending" }, { $set: { "cancellationRequest.status": "withdrawn", "cancellationRequest.respondedAt": new Date() } });
    return Payment.findById(order._id);
  }
  if (mine) throw new ApiError(httpStatus.FORBIDDEN, "The other side has to answer this request");
  if (action === "accept") {
    const done = await accept(order, userId);
    await notify(isBuyer ? order.freelancerId : order.clientId, isBuyer ? "freelancer" : "buyer", "Your cancellation request was accepted. The order is cancelled.");
    return done;
  }
  if (action === "decline") {
    await Payment.updateOne({ _id: order._id, "cancellationRequest.status": "pending" }, { $set: { "cancellationRequest.status": "declined", "cancellationRequest.respondedAt": new Date() } });
    await notify(isBuyer ? order.freelancerId : order.clientId, isBuyer ? "freelancer" : "buyer", "Your cancellation request was declined. You can open a dispute if you can't agree.");
    return Payment.findById(order._id);
  }
  throw new ApiError(httpStatus.BAD_REQUEST, "action must be accept, decline or withdraw");
}

/** Housekeeping: accept requests nobody answered in time. */
async function autoAcceptExpired() {
  const due = await Payment.find({ "cancellationRequest.status": "pending", "cancellationRequest.respondBy": { $lt: new Date() }, status: { $in: OPEN } }).limit(100);
  let n = 0;
  for (const o of due) {
    try {
      await accept(o, null, true);
      n++;
    } catch (e) {
      logger.warn(`auto-cancel ${o._id} skipped: ${e.message}`);
    }
  }
  return n;
}

module.exports = { request, respond, autoAcceptExpired, RESPONSE_HOURS };
