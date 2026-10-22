const crypto = require("crypto");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { User } = require("../models");
const totp = require("../utils/totp");

const hash = (c) => crypto.createHash("sha256").update(String(c).replace(/[\s-]/g, "").toLowerCase()).digest("hex");

/** Check a TOTP or one-time recovery code; consumes it. Returns true/false. */
async function check(user, code) {
  const c = String(code || "").trim();
  if (!c || !user.twoFactorEnabled) return false;
  const step = totp.verify(user.twoFactorSecret, c);
  if (step !== null) {
    // Replay protection: each time-step can be used once.
    const r = await User.updateOne({ _id: user._id, twoFactorLastStep: { $lt: step } }, { $set: { twoFactorLastStep: step } });
    return r.modifiedCount === 1;
  }
  const h = hash(c);
  const r = await User.updateOne({ _id: user._id, twoFactorRecovery: h }, { $pull: { twoFactorRecovery: h } });
  return r.modifiedCount === 1;
}

async function setup(userId) {
  const user = await User.findById(userId);
  const secret = totp.generateSecret();
  user.twoFactorPending = secret;
  await user.save();
  return { secret, otpauthUrl: totp.otpauthUrl(secret, user.email) };
}

async function enable(userId, code) {
  const user = await User.findById(userId);
  if (!user.twoFactorPending) throw new ApiError(httpStatus.BAD_REQUEST, "Start setup first");
  const step = totp.verify(user.twoFactorPending, code);
  if (step === null) throw new ApiError(httpStatus.BAD_REQUEST, "That code is not valid. Check your device's clock and try again.");
  const recovery = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString("hex").replace(/(.{5})/, "$1-"));
  user.twoFactorSecret = user.twoFactorPending;
  user.twoFactorPending = null;
  user.twoFactorEnabled = true;
  user.twoFactorLastStep = step;
  user.twoFactorRecovery = recovery.map(hash);
  await user.save();
  return { recoveryCodes: recovery };
}

async function disable(user, code) {
  if (!user.twoFactorEnabled) return;
  if (!(await check(user, code))) throw new ApiError(httpStatus.BAD_REQUEST, "Enter a valid code to turn two-factor off");
  await User.updateOne({ _id: user._id }, { $set: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecovery: [], twoFactorPending: null } });
}

/** Super admin resets another admin's 2FA (lost device). */
async function reset(userId) {
  await User.updateOne({ _id: userId }, { $set: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecovery: [], twoFactorPending: null } });
}

const jwt = require("jsonwebtoken");
const config = require("../config/config");
/** Short-lived proof that the first factor (Google) succeeded. */
function challengeFor(user) {
  return jwt.sign({ sub: String(user._id), typ: "2fa-challenge" }, config.jwt.secret, { expiresIn: "5m" });
}
async function userFromChallenge(token) {
  let p;
  try {
    p = jwt.verify(String(token || ""), config.jwt.secret);
  } catch {
    p = null;
  }
  if (!p || p.typ !== "2fa-challenge") throw new ApiError(httpStatus.UNAUTHORIZED, "Sign-in expired. Start again.");
  const user = await User.findById(p.sub);
  if (!user || user.isDeleted) throw new ApiError(httpStatus.UNAUTHORIZED, "Account not available");
  if (user.isBan) throw new ApiError(httpStatus.FORBIDDEN, `BANNED:${user.banReason || "Your account has been suspended by an administrator."}`);
  return user;
}

module.exports = { check, setup, enable, disable, reset, challengeFor, userFromChallenge };
