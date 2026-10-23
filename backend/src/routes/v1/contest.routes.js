const express = require("express");
const auth = require("../../middlewares/auth");
const optionalAuth = require("../../middlewares/optionalAuth");
const catchAsync = require("../../utils/catchAsync");
const svc = require("../../services/contest.service");

const router = express.Router();
const ok = (res, attributes, message = "OK", code = 200) => res.status(code).json({ code, message, data: { attributes } });
const U = auth("common");

router.get("/", catchAsync(async (req, res) => ok(res, await svc.list(req.query))));
router.post("/", U, catchAsync(async (req, res) => ok(res, await svc.create(req.user, req.body || {}), "Contest posted", 201)));
router.get("/mine", U, catchAsync(async (req, res) => ok(res, await svc.mine(req.user))));
router.get("/:id", optionalAuth(), catchAsync(async (req, res) => ok(res, await svc.getOne(req.params.id, req.user))));
router.post("/:id/entries", U, catchAsync(async (req, res) => ok(res, await svc.enter(req.params.id, req.user, req.body || {}), "Entry submitted", 201)));
router.post("/:id/entries/:entryId/withdraw", U, catchAsync(async (req, res) => ok(res, await svc.withdraw(req.params.id, req.user, req.params.entryId))));
router.post("/:id/award", U, catchAsync(async (req, res) => ok(res, await svc.award(req.params.id, req.user, req.body?.entryId), "Winner picked")));
router.post("/:id/handover", U, catchAsync(async (req, res) => ok(res, await svc.submitHandover(req.params.id, req.user, req.body || {}), "Handover sent")));
router.post("/:id/accept-handover", U, catchAsync(async (req, res) => ok(res, await svc.acceptHandover(req.params.id, req.user), "Prize released")));
router.post("/:id/cancel", U, catchAsync(async (req, res) => ok(res, await svc.cancel(req.params.id, req.user), "Contest cancelled")));

module.exports = router;
