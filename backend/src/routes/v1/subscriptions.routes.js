const express = require("express");
const auth = require("../../middlewares/auth");
const catchAsync = require("../../utils/catchAsync");
const svc = require("../../services/subscription.service");

const router = express.Router();
const ok = (res, attributes, message = "OK") => res.json({ code: 200, message, data: { attributes } });

router.get("/", auth("common"), catchAsync(async (req, res) => ok(res, { results: await svc.list(req.user._id, req.query.role === "seller" ? "seller" : "buyer") })));
router.post("/", auth("common"), catchAsync(async (req, res) => ok(res, await svc.subscribe(req.user._id, req.body || {}), "Subscribed")));
router.patch("/:id", auth("common"), catchAsync(async (req, res) => ok(res, await svc.act(req.user._id, req.params.id, req.body?.action), "Subscription updated")));
// Seller opts a gig in or out.
router.put("/gig/:gigId", auth("common"), catchAsync(async (req, res) => ok(res, await svc.setGigOption(req.user._id, req.params.gigId, req.body || {}), "Saved")));
module.exports = router;
