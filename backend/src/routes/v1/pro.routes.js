const express = require("express");
const auth = require("../../middlewares/auth");
const catchAsync = require("../../utils/catchAsync");
const svc = require("../../services/pro.service");

const router = express.Router();
const ok = (res, attributes, message = "OK", code = 200) => res.status(code).json({ code, message, data: { attributes } });

router.get("/me", auth("common"), catchAsync(async (req, res) => ok(res, await svc.status(req.user.id))));
router.post("/apply", auth("common"), catchAsync(async (req, res) => ok(res, await svc.apply(req.user, req.body || {}), "Application sent", 201)));
router.post("/concierge", auth("common"), catchAsync(async (req, res) => ok(res, await svc.concierge(req.user, req.body || {}), "Request sent", 201)));

module.exports = router;
