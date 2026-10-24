// Buyer-facing coupon check and referral dashboard.
const express = require("express");
const auth = require("../../middlewares/auth");
const catchAsync = require("../../utils/catchAsync");

const router = express.Router();
const ok = (res, data, message = "OK") => res.json({ code: 200, message, data: { attributes: data } });

router.get("/referrals/me", auth("withOutAdmin"), catchAsync(async (req, res) => {
  ok(res, await require("../../services/referral.service").summary(req.user));
}));

router.get("/welcome/me", auth("withOutAdmin"), catchAsync(async (req, res) => {
  ok(res, await require("../../services/referral.service").myWelcome(req.user));
}));

module.exports = router;
