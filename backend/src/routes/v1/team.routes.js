const express = require("express");
const auth = require("../../middlewares/auth");
const catchAsync = require("../../utils/catchAsync");
const svc = require("../../services/team.service");

const router = express.Router();
const ok = (res, attributes, message = "OK", code = 200) => res.status(code).json({ code, message, data: { attributes } });
const U = auth("withOutAdmin");

router.get("/", U, catchAsync(async (req, res) => ok(res, await svc.mine(req.user))));
router.post("/", U, catchAsync(async (req, res) => ok(res, await svc.create(req.user, req.body || {}), "Team created", 201)));
router.post("/:id/invite", U, catchAsync(async (req, res) => ok(res, await svc.invite(req.params.id, req.user, req.body || {}), "Invited", 201)));
router.post("/:id/accept", U, catchAsync(async (req, res) => ok(res, await svc.respond(req.params.id, req.user, true), "Joined")));
router.post("/:id/decline", U, catchAsync(async (req, res) => ok(res, await svc.respond(req.params.id, req.user, false), "Declined")));
router.patch("/:id/members/:memberId", U, catchAsync(async (req, res) => ok(res, await svc.setRole(req.params.id, req.user, req.params.memberId, req.body?.role))));
router.delete("/:id/members/:memberId", U, catchAsync(async (req, res) => ok(res, await svc.remove(req.params.id, req.user, req.params.memberId), "Removed")));
router.get("/:id/orders", U, catchAsync(async (req, res) => ok(res, await svc.orders(req.params.id, req.user, req.query))));

module.exports = router;
