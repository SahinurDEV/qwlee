const express = require("express");
const rateLimit = require("express-rate-limit");
const catchAsync = require("../../utils/catchAsync");
const help = require("../../services/help.service");

const router = express.Router();
const ok = (res, attributes, message = "OK") => res.json({ code: 200, message, data: { attributes } });
const feedbackLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

router.get("/", catchAsync(async (req, res) => ok(res, await help.listPublic(req.query))));
router.get("/:slug", catchAsync(async (req, res) => ok(res, await help.getPublic(req.params.slug))));
router.post("/:slug/feedback", feedbackLimiter, catchAsync(async (req, res) => {
  await help.feedback(req.params.slug, req.body?.helpful === true);
  ok(res, {}, "Thanks for your feedback");
}));
module.exports = router;
