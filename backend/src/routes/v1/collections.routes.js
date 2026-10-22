const express = require("express");
const auth = require("../../middlewares/auth");
const optionalAuth = require("../../middlewares/optionalAuth");
const catchAsync = require("../../utils/catchAsync");
const svc = require("../../services/collections.service");

const router = express.Router();
const ok = (res, attributes, message = "OK") => res.json({ code: 200, message, data: { attributes } });

router.get("/", auth("common"), catchAsync(async (req, res) => ok(res, { results: await svc.list(req.user._id), max: svc.MAX_COLLECTIONS })));
router.patch("/item", auth("common"), catchAsync(async (req, res) => ok(res, await svc.move(req.user._id, req.body?.gigId, req.body?.collection), "Moved")));
router.patch("/rename", auth("common"), catchAsync(async (req, res) => ok(res, await svc.rename(req.user._id, req.body?.from, req.body?.to), "Collection renamed")));
router.delete("/", auth("common"), catchAsync(async (req, res) => ok(res, await svc.remove(req.user._id, req.query.name), "Collection deleted; its gigs stay saved")));
router.get("/recommended", optionalAuth(), catchAsync(async (req, res) => {
  const seen = String(req.query.seen || "").split(",").map((s) => s.trim()).filter(Boolean);
  ok(res, await svc.recommend({ userId: req.user?._id, seen, limit: req.query.limit }));
}));
module.exports = router;
