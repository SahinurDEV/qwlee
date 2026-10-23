// Milestone payments for custom offers. The buyer pays the full offer into
// escrow at checkout, as for any order; the seller's offer splits it into
// 2-6 milestones. The buyer releases each milestone's share as the work
// arrives, and accepting the order (or auto-completion) releases the rest.
// Cancelling refunds only what has not been released.
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { Payment, User } = require("../models");
const appConfigService = require("./appConfig.service");

const MIN = 2;
const MAX = 6;
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const OPEN = ["active", "late"];

/** Validate an offer's milestones. Returns the clean list, or [] when none. */
function normalise(list, price) {
  if (list == null || (Array.isArray(list) && list.length === 0)) return [];
  if (!Array.isArray(list) || list.length < MIN || list.length > MAX) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Use between ${MIN} and ${MAX} milestones`);
  }
  const clean = list.map((m, i) => {
    const title = String(m?.title || "").trim().slice(0, 80);
    const amount = round2(m?.amount);
    const days = Number(m?.days);
    if (!title) throw new ApiError(httpStatus.BAD_REQUEST, `Milestone ${i + 1} needs a title`);
    if (!(amount >= 5)) throw new ApiError(httpStatus.BAD_REQUEST, `Milestone ${i + 1} must be at least $5`);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new ApiError(httpStatus.BAD_REQUEST, `Milestone ${i + 1} needs 1-365 days`);
    return { title, amount, days };
  });
  const sum = round2(clean.reduce((n, m) => n + m.amount, 0));
  if (sum !== round2(price)) throw new ApiError(httpStatus.BAD_REQUEST, `Milestones add up to $${sum}, but the offer is $${round2(price)}`);
  return clean;
}

/** Order copy of the milestones, each waiting for release. */
const forOrder = (list) => (list || []).map((m) => ({ title: m.title, amount: m.amount, days: m.days, status: "pending", releasedAt: null }));

/** Buyer releases one milestone's share of escrow to the seller. */
async function release(orderId, userId, index) {
  const order = await Payment.findById(orderId);
  if (!order || String(order.clientId) !== String(userId)) {
    if (order && String(order.freelancerId) === String(userId)) throw new ApiError(httpStatus.FORBIDDEN, "Only the buyer can release a milestone");
    throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  }
  const list = order.data?.milestones || [];
  const n = Number(index);
  if (!Number.isInteger(n) || !list[n]) throw new ApiError(httpStatus.NOT_FOUND, "Milestone not found");
  if (list[n].status !== "pending") throw new ApiError(httpStatus.CONFLICT, "Milestone already released");
  if (!OPEN.includes(order.status)) throw new ApiError(httpStatus.CONFLICT, `Order is ${order.status}`);
  // The last open milestone completes the order (releasing the remainder).
  if (list.filter((m) => m.status === "pending").length === 1) {
    return require("./orderLifecycle.service").completeOrder(order, { reason: "milestones" });
  }
  const feePercent = await appConfigService.getPlatformFeePercent(order.gigId, { clientId: order.clientId });
  const amount = round2(list[n].amount);
  const fee = round2((amount * feePercent) / 100);
  const net = round2(amount - fee);
  const now = new Date();
  // Atomic: the milestone must still be pending and the escrow still held.
  const updated = await Payment.findOneAndUpdate(
    { _id: order._id, status: { $in: OPEN }, "escrow.status": { $nin: ["released", "refunded"] }, [`data.milestones.${n}.status`]: "pending" },
    {
      $set: { [`data.milestones.${n}.status`]: "released", [`data.milestones.${n}.releasedAt`]: now },
      $inc: { "escrow.releasedGross": amount, "escrow.releasedFee": fee, "escrow.releasedNet": net },
    },
    { new: true }
  );
  if (!updated) throw new ApiError(httpStatus.CONFLICT, "Milestone cannot be released now");
  await User.updateOne({ _id: order.freelancerId }, { $inc: { balance: net } });
  return updated;
}

module.exports = { normalise, forOrder, release, MIN, MAX };
