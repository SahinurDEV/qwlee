// CRUD for the signed-in user's quick replies (max 50).
const express = require("express");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const auth = require("../../middlewares/auth");
const catchAsync = require("../../utils/catchAsync");
const ApiError = require("../../utils/ApiError");
const { QuickReply } = require("../../models");

const router = express.Router();
const ok = (res, data, message = "OK", code = 200) => res.status(code).json({ code, message, data: { attributes: data } });
const view = (q) => ({ id: String(q._id), title: q.title, body: q.body, updatedAt: q.updatedAt });
const clean = (b = {}) => {
  const title = String(b.title || "").trim();
  const body = String(b.body || "").trim();
  if (!title || title.length > 60) throw new ApiError(httpStatus.BAD_REQUEST, "Title is required (max 60 characters)");
  if (!body || body.length > 2000) throw new ApiError(httpStatus.BAD_REQUEST, "Message is required (max 2000 characters)");
  return { title, body };
};
const mine = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid id");
  const q = await QuickReply.findOne({ _id: req.params.id, user: req.user._id });
  if (!q) throw new ApiError(httpStatus.NOT_FOUND, "Quick reply not found");
  return q;
};

router.get("/", auth("withOutAdmin"), catchAsync(async (req, res) => {
  ok(res, { results: (await QuickReply.find({ user: req.user._id }).sort({ title: 1 }).lean()).map(view) });
}));
router.post("/", auth("withOutAdmin"), catchAsync(async (req, res) => {
  if ((await QuickReply.countDocuments({ user: req.user._id })) >= 50) throw new ApiError(httpStatus.CONFLICT, "You can keep up to 50 quick replies");
  ok(res, view(await QuickReply.create({ user: req.user._id, ...clean(req.body) })), "Saved", 201);
}));
router.patch("/:id", auth("withOutAdmin"), catchAsync(async (req, res) => {
  const q = await mine(req);
  Object.assign(q, clean(req.body));
  await q.save();
  ok(res, view(q), "Saved");
}));
router.delete("/:id", auth("withOutAdmin"), catchAsync(async (req, res) => {
  await (await mine(req)).deleteOne();
  ok(res, { ok: true }, "Deleted");
}));

module.exports = router;
