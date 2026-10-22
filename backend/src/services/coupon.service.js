const httpStatus = require("http-status");
const crypto = require("crypto");
const ApiError = require("../utils/ApiError");
const { Coupon, Payment } = require("../models");

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const norm = (c) => String(c || "").trim().toUpperCase();

/** Discount for `total` with `code` for `buyerId`, or throws a 400 with the reason. */
async function evaluate(code, buyerId, total) {
  const coupon = await Coupon.findOne({ code: norm(code) });
  const bad = (m) => { throw new ApiError(httpStatus.BAD_REQUEST, m); };
  if (!coupon || !coupon.active) bad("This coupon code isn't valid");
  if (coupon.expiresAt && coupon.expiresAt < new Date()) bad("This coupon has expired");
  if (coupon.maxUses != null && coupon.uses >= coupon.maxUses) bad("This coupon has been used up");
  if (coupon.onlyUser && String(coupon.onlyUser) !== String(buyerId)) bad("This coupon belongs to another account");
  const mine = coupon.redemptions.filter((r) => String(r.user) === String(buyerId)).length;
  if (coupon.perUserLimit && mine >= coupon.perUserLimit) bad("You've already used this coupon");
  if (total < (coupon.minOrder || 0)) bad(`This coupon needs an order of at least $${coupon.minOrder}`);
  if (coupon.firstOrderOnly && (await Payment.exists({ clientId: buyerId }))) bad("This coupon is for your first order only");
  let discount = coupon.type === "percent" ? (total * coupon.value) / 100 : coupon.value;
  if (coupon.type === "percent" && coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  // Always leave at least $1 to charge.
  discount = round2(Math.max(0, Math.min(discount, total - 1)));
  return { code: coupon.code, discount, description: coupon.type === "percent" ? `${coupon.value}% off` : `$${coupon.value} off` };
}

/** Record a use when the order is created. Best effort if it raced to exhaustion. */
async function redeem(code, buyerId, orderId, amount) {
  const q = { code: norm(code), active: true };
  const r = await Coupon.updateOne(
    { ...q, $or: [{ maxUses: null }, { $expr: { $lt: ["$uses", "$maxUses"] } }] },
    { $inc: { uses: 1 }, $push: { redemptions: { user: buyerId, order: orderId, amount, at: new Date() } } }
  );
  return r.modifiedCount > 0;
}

function randomCode(prefix) {
  return `${prefix}${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

module.exports = { evaluate, redeem, randomCode, norm, round2 };
