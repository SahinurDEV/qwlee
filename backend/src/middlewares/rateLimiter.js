const rateLimit = require('express-rate-limit');

// Counts failed /v1/auth requests per IP (successes are free). Asking for a
// two-factor code after a correct password is a normal step, not a failure.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  // Key by Express's req.ip (respects trust proxy hops) — not raw XFF.
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || "unknown",
  requestWasSuccessful: (req, res) => res.statusCode < 400 || res.locals.twoFactorPrompt === true,
});

module.exports = {
  authLimiter,
};
