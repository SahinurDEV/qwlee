const httpStatus = require("http-status");
const mongoose = require("mongoose");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const { Coupon } = require("../models");

const ok = (res, data, message = "OK", code = 200) => res.status(code).json({ code, message, data: { attributes: data } });
const view = (c) => ({
  id: String(c._id), code: c.code, type: c.type, value: c.value, maxDiscount: c.maxDiscount, minOrder: c.minOrder,
  maxUses: c.maxUses, perUserLimit: c.perUserLimit, uses: c.uses, expiresAt: c.expiresAt, active: c.active,
  firstOrderOnly: c.firstOrderOnly, onlyUser: c.onlyUser, source: c.source, note: c.note, createdAt: c.createdAt,
  discountGiven: Math.round((c.redemptions || []).reduce((n, r) => n + (r.amount || 0), 0) * 100) / 100,
});

function clean(b = {}, partial = false) {
  const out = {};
  const bad = (m) => { throw new ApiError(httpStatus.BAD_REQUEST, m); };
  if (!partial || b.code !== undefined) {
    const code = String(b.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) bad("Code: 3-32 letters, digits, - or _");
    out.code = code;
  }
  if (!partial || b.type !== undefined) {
    if (!["percent", "fixed"].includes(b.type)) bad("Type must be percent or fixed");
    out.type = b.type;
  }
  if (!partial || b.value !== undefined) {
    const v = Number(b.value);
    if (!(v > 0) || ((b.type || out.type) === "percent" && v > 100)) bad("Value must be > 0 (and at most 100 for percent)");
    out.value = v;
  }
  const optNum = (k, min = 0) => {
    if (b[k] === undefined) return;
    if (b[k] === null || b[k] === "") { out[k] = null; return; }
    const v = Number(b[k]);
    if (!(v >= min)) bad(`${k} must be a number ≥ ${min}`);
    out[k] = v;
  };
  optNum("maxDiscount"); optNum("minOrder"); optNum("maxUses", 1); optNum("perUserLimit", 1);
  if (b.expiresAt !== undefined) out.expiresAt = b.expiresAt ? new Date(b.expiresAt) : null;
  if (out.expiresAt && Number.isNaN(out.expiresAt.getTime())) bad("Invalid expiry date");
  if (b.active !== undefined) out.active = !!b.active;
  if (b.firstOrderOnly !== undefined) out.firstOrderOnly = !!b.firstOrderOnly;
  if (b.note !== undefined) out.note = String(b.note).slice(0, 200);
  return out;
}

const list = catchAsync(async (req, res) => {
  const f = {};
  if (req.query.source) f.source = String(req.query.source);
  if (req.query.search) f.code = { $regex: String(req.query.search).replace(/[^A-Za-z0-9_-]/g, ""), $options: "i" };
  const rows = await Coupon.find(f).sort({ createdAt: -1 }).limit(200).lean();
  ok(res, { results: rows.map(view) });
});
const create = catchAsync(async (req, res) => {
  const data = clean(req.body);
  if (await Coupon.exists({ code: data.code })) throw new ApiError(httpStatus.CONFLICT, "That code already exists");
  ok(res, view(await Coupon.create({ ...data, source: "admin" })), "Coupon created", 201);
});
const update = catchAsync(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid id");
  const data = clean(req.body, true);
  delete data.code;
  const c = await Coupon.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
  if (!c) throw new ApiError(httpStatus.NOT_FOUND, "Coupon not found");
  ok(res, view(c), "Coupon updated");
});

module.exports = { list, create, update };
