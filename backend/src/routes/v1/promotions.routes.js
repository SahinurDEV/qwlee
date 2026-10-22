const express = require("express");
const auth = require("../../middlewares/auth");
const catchAsync = require("../../utils/catchAsync");
const rateLimit = require("express-rate-limit");
const svc = require("../../services/promotion.service");

const router = express.Router();
const ok = (res, attributes, message = "OK") => res.json({ code: 200, message, data: { attributes } });
const clickLimit = rateLimit({ windowMs: 60000, max: 60, standardHeaders: true, legacyHeaders: false });

router.get("/config", (req, res) => ok(res, svc.config()));
router.get("/", auth("common"), catchAsync(async (req, res) => ok(res, { results: await svc.list(req.user._id), ...svc.config() })));
router.post("/", auth("common"), catchAsync(async (req, res) => ok(res, await svc.create(req.user._id, req.body || {}), "Gig promoted")));
router.post("/:id/cancel", auth("common"), catchAsync(async (req, res) => ok(res, await svc.cancel(req.user._id, req.params.id), "Promotion cancelled")));
// Sponsored card clicked in search (anonymous, rate limited).
router.post("/click/:gigId", clickLimit, catchAsync(async (req, res) => {
  await svc.track([req.params.gigId], "clicks");
  ok(res, {});
}));
module.exports = router;
