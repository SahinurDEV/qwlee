// Two-factor sign-in for every account (admins also have /admin/2fa).
// Kept outside /auth, whose limiter counts refused requests.
const express = require("express");
const httpStatus = require("http-status");
const auth = require("../../middlewares/auth");
const catchAsync = require("../../utils/catchAsync");
const ApiError = require("../../utils/ApiError");
const { User } = require("../../models");
const twoFactor = require("../../services/twoFactor.service");
const siteSettings = require("../../services/siteSettings.service");

const router = express.Router();
const ok = (res, attributes, message = "OK") => res.json({ code: 200, message, data: { attributes } });

router.get("/", auth("common"), catchAsync(async (req, res) => {
  const u = await User.findById(req.user._id).select("+twoFactorRecovery").lean();
  ok(res, { enabled: !!u.twoFactorEnabled, recoveryLeft: u.twoFactorRecovery?.length || 0 });
}));
router.post("/setup", auth("common"), catchAsync(async (req, res) => {
  if (req.user.twoFactorEnabled) throw new ApiError(httpStatus.CONFLICT, "Two-factor is already on");
  ok(res, await twoFactor.setup(req.user._id));
}));
router.post("/enable", auth("common"), catchAsync(async (req, res) => {
  ok(res, await twoFactor.enable(req.user._id, String(req.body?.code || "")), "Two-factor is on");
}));
router.post("/disable", auth("common"), catchAsync(async (req, res) => {
  if (req.user.role === "admin" && (await siteSettings.get()).security?.requireAdmin2fa) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Two-factor is required for admins on this site");
  }
  const full = await User.findById(req.user._id).select("+twoFactorSecret +twoFactorRecovery +twoFactorLastStep");
  await twoFactor.disable(full, req.body?.code);
  ok(res, { enabled: false }, "Two-factor is off");
}));
module.exports = router;
