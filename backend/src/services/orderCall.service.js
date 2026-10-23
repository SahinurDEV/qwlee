// Calls inside orders. Buyer or seller proposes 1-5 future slots; the other
// side accepts one (→ scheduled, meeting link created) or declines.
// MEETING_BASE_URL sets the meeting host (default: a Jitsi room name,
// a demo link that hasn't been verified against a real provider).
const crypto = require("crypto");
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const { OrderCall, Payment, Notification } = require("../models");

const idOf = (v) => String(v?._id || v || "");
const meetingBase = () => (process.env.MEETING_BASE_URL || "https://meet.jit.si").replace(/\/+$/, "");

async function orderFor(orderId, user) {
  if (!mongoose.isValidObjectId(orderId)) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  const o = await Payment.findById(orderId).select("clientId freelancerId status");
  if (!o) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  const uid = String(user.id);
  if (idOf(o.clientId) !== uid && idOf(o.freelancerId) !== uid) throw new ApiError(httpStatus.FORBIDDEN, "Not your order");
  o.other = idOf(o.clientId) === uid ? o.freelancerId : o.clientId;
  return o;
}
const notify = (receiverId, message, linkId) => Notification.create({ receiverId, message, linkId, type: "order" }).catch(() => null);

async function list(orderId, user) {
  await orderFor(orderId, user);
  return OrderCall.find({ orderId }).sort({ createdAt: -1 }).limit(50);
}

async function propose(orderId, user, body = {}) {
  const o = await orderFor(orderId, user);
  const now = Date.now();
  const slots = [...new Set((Array.isArray(body.slots) ? body.slots : []).map((s) => new Date(s).getTime()))]
    .filter((t) => Number.isFinite(t) && t > now + 5 * 60000 && t < now + 90 * 86400000).sort().map((t) => new Date(t));
  if (slots.length < 1 || slots.length > 5) throw new ApiError(httpStatus.BAD_REQUEST, "Give 1-5 future time slots");
  const durationMin = Math.round(Number(body.durationMin) || 30);
  if (durationMin < 15 || durationMin > 120) throw new ApiError(httpStatus.BAD_REQUEST, "Duration must be 15-120 minutes");
  const open = await OrderCall.countDocuments({ orderId, status: "proposed" });
  if (open >= 3) throw new ApiError(httpStatus.BAD_REQUEST, "Too many open call proposals on this order");
  const call = await OrderCall.create({ orderId, proposedBy: user.id, topic: String(body.topic || "").replace(/<[^>]*>/g, "").slice(0, 200), durationMin, slots });
  notify(o.other, "New call proposal on your order", String(orderId));
  return call;
}

async function callFor(orderId, callId, user) {
  const o = await orderFor(orderId, user);
  const c = mongoose.isValidObjectId(callId) ? await OrderCall.findOne({ _id: callId, orderId }) : null;
  if (!c) throw new ApiError(httpStatus.NOT_FOUND, "Call not found");
  return { o, c };
}

async function accept(orderId, callId, user, slot) {
  const { o, c } = await callFor(orderId, callId, user);
  if (c.status !== "proposed") throw new ApiError(httpStatus.BAD_REQUEST, "This proposal is closed");
  if (idOf(c.proposedBy) === String(user.id)) throw new ApiError(httpStatus.FORBIDDEN, "The other side must accept");
  const t = new Date(slot).getTime();
  const pick = c.slots.find((s) => s.getTime() === t);
  if (!pick) throw new ApiError(httpStatus.BAD_REQUEST, "Pick one of the proposed slots");
  if (pick.getTime() < Date.now()) throw new ApiError(httpStatus.BAD_REQUEST, "That slot has passed");
  c.startsAt = pick; c.status = "scheduled";
  c.meetingUrl = `${meetingBase()}/qwlee-${crypto.randomBytes(8).toString("hex")}`;
  await c.save();
  notify(o.other, `Call scheduled for ${pick.toISOString()}`, String(orderId));
  return c;
}

async function setStatus(orderId, callId, user, status) {
  const { o, c } = await callFor(orderId, callId, user);
  if (status === "declined" && (c.status !== "proposed" || idOf(c.proposedBy) === String(user.id))) throw new ApiError(httpStatus.BAD_REQUEST, "You can't decline this");
  if (status === "cancelled" && !["proposed", "scheduled"].includes(c.status)) throw new ApiError(httpStatus.BAD_REQUEST, "Already closed");
  c.status = status; await c.save();
  notify(o.other, `Call ${status}`, String(orderId));
  return c;
}

module.exports = { list, propose, accept, setStatus };
