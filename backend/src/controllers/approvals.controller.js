const httpStatus = require("http-status");
const mongoose = require("mongoose");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const config = require("../config/config");
const { Approval } = require("../models");
const perms = require("../config/adminPermissions");

const PERM = { refund: "orders.write", withdrawal: "finance" };
const ok = (res, data, message = "OK") => res.status(200).json({ code: 200, message, data: { attributes: data } });

const load = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid id");
  const ap = await Approval.findById(id);
  if (!ap) throw new ApiError(httpStatus.NOT_FOUND, "Approval not found");
  return ap;
};
const decider = (req, ap) => {
  if (ap.status !== "pending") throw new ApiError(httpStatus.CONFLICT, `Already ${ap.status}`);
  if (String(ap.requestedBy) === String(req.user._id)) throw new ApiError(httpStatus.FORBIDDEN, "A different admin must approve this");
  if (!perms.can(req.user, PERM[ap.kind])) throw new ApiError(httpStatus.FORBIDDEN, `Needs the ${PERM[ap.kind]} permission`);
};

const list = catchAsync(async (req, res) => {
  const f = {};
  if (req.query.status) f.status = String(req.query.status);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 25);
  const [results, total] = await Promise.all([
    Approval.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("requestedBy", "fullName email").populate("decidedBy", "fullName email").lean(),
    Approval.countDocuments(f),
  ]);
  ok(res, { results: results.map(({ _id, ...r }) => ({ id: String(_id), ...r })), page, limit, totalResults: total, totalPages: Math.ceil(total / limit) });
});

const approve = catchAsync(async (req, res) => {
  const ap = await load(req.params.id);
  decider(req, ap);
  const claimed = await Approval.findOneAndUpdate(
    { _id: ap._id, status: "pending" },
    { $set: { status: "approved", decidedBy: req.user._id, decidedAt: new Date() } },
    { new: true }
  );
  if (!claimed) throw new ApiError(httpStatus.CONFLICT, "Already decided");
  // Replay the original request as the approver.
  const r = await fetch(`http://127.0.0.1:${config.port}/v1${ap.path}`, {
    method: ap.method,
    headers: { "content-type": "application/json", authorization: req.get("authorization"), "x-approval-id": String(ap._id) },
    body: ap.method === "GET" ? undefined : JSON.stringify(ap.body || {}),
  });
  const json = await r.json().catch(() => ({}));
  const done = r.status < 300 && r.status !== 202;
  await Approval.updateOne({ _id: ap._id }, { $set: { status: done ? "approved" : "failed", result: String(json?.message || r.status).slice(0, 300) } });
  if (!done) throw new ApiError(r.status >= 400 ? r.status : httpStatus.CONFLICT, `Approved, but the action failed: ${json?.message || r.status}`);
  ok(res, { approval: { ...claimed.toJSON(), result: json?.message }, outcome: json?.data?.attributes || null }, "Approved and executed");
});

const reject = catchAsync(async (req, res) => {
  const ap = await load(req.params.id);
  decider(req, ap);
  await Approval.updateOne({ _id: ap._id, status: "pending" }, { $set: { status: "rejected", decidedBy: req.user._id, decidedAt: new Date(), result: String(req.body?.reason || "").slice(0, 300) } });
  ok(res, { id: String(ap._id) }, "Rejected");
});

module.exports = { list, approve, reject };
