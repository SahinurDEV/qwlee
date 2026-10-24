// Order-page requests between buyer and seller. One open request per order
// at a time (cancellation, delivery extension or progress update), so the
// other side always knows what they are answering.
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { Payment } = require("../models");

const OPEN = ["active", "late"];
const idOf = (v) => String(v?._id || v || "");
const LABEL = { cancellation: "a cancellation request", extension: "a delivery extension request", update: "an update request" };

/** The kind of request already open on this order, or "". */
function openRequest(order) {
  if (order?.cancellationRequest?.status === "pending") return "cancellation";
  if (order?.extensionRequest?.status === "pending") return "extension";
  if (order?.updateRequest?.status === "pending") return "update";
  return "";
}

/** Throw 409 when another request is already open (`except` = same kind allowed to report its own message). */
function assertNoOpenRequest(order, except = "") {
  // An open update request never blocks a cancellation or extension: an
  // extension is often the seller's answer to it.
  const kind = openRequest(order);
  if (kind === "update" && except !== "update") return;
  if (kind && kind !== except) throw new ApiError(httpStatus.CONFLICT, `This order already has ${LABEL[kind]} open. Wait for it to be answered first.`);
}

async function notify(userId, role, message, linkId) {
  try {
    await require("./notification.service").addCustomNotification(`${role}-notification`, userId, { receiverId: userId, message, linkId, role, type: "order", viewStatus: false });
  } catch { /* best effort */ }
}

/** Buyer asks the seller for a progress update. */
async function askForUpdate(orderId, userId, note) {
  const order = await Payment.findById(orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  if (idOf(order.clientId) !== String(userId)) throw new ApiError(httpStatus.FORBIDDEN, "Only the buyer can ask for an update");
  if (!OPEN.includes(order.status)) throw new ApiError(httpStatus.CONFLICT, `Order is ${order.status}`);
  if (order.delivery?.state === "submitted") throw new ApiError(httpStatus.CONFLICT, "The seller has delivered. Review the delivery instead.");
  assertNoOpenRequest(order, "update");
  const r = await Payment.updateOne(
    { _id: order._id, "updateRequest.status": { $ne: "pending" }, "cancellationRequest.status": { $ne: "pending" }, "extensionRequest.status": { $ne: "pending" } },
    { $set: { updateRequest: { status: "pending", note: String(note || "").trim().slice(0, 500), requestedAt: new Date(), reply: "", answeredAt: null } } }
  );
  if (!r.modifiedCount) throw new ApiError(httpStatus.CONFLICT, "You already asked for an update. Wait for the seller to answer.");
  await notify(order.freelancerId, "freelancer", "Your buyer asked for an update on their order.", order._id);
  return Payment.findById(order._id);
}

/** Seller answers the update request. */
async function answerUpdate(orderId, userId, reply) {
  const order = await Payment.findById(orderId);
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  if (idOf(order.freelancerId) !== String(userId)) throw new ApiError(httpStatus.FORBIDDEN, "Only the seller can answer");
  const text = String(reply || "").trim();
  if (text.length < 5) throw new ApiError(httpStatus.BAD_REQUEST, "Write a short update (at least 5 characters)");
  const r = await Payment.updateOne({ _id: order._id, "updateRequest.status": "pending" }, { $set: { "updateRequest.status": "answered", "updateRequest.reply": text.slice(0, 2000), "updateRequest.answeredAt": new Date() } });
  if (!r.modifiedCount) throw new ApiError(httpStatus.CONFLICT, "There is no open update request");
  await notify(order.clientId, "buyer", "The seller sent an update on your order.", order._id);
  return Payment.findById(order._id);
}

module.exports = { openRequest, assertNoOpenRequest, askForUpdate, answerUpdate };
