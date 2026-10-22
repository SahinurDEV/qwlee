// Maintenance mode (Admin → Site settings). While on, the API answers 503
// for everything except site info, sign-in and the admin API, unless the
// request carries an admin's access token.
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const siteSettings = require("../services/siteSettings.service");
const User = require("../models/user.model");
const { tokenTypes } = require("../config/tokens");

const OPEN = /^\/v1\/(info|auth|admin|docs)(\/|$)/;

async function isAdmin(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return false;
  try {
    const p = jwt.verify(h.slice(7), config.jwt.secret);
    if (p.type !== tokenTypes.ACCESS) return false;
    const u = await User.findById(p.sub, "role").lean();
    return u?.role === "admin";
  } catch {
    return false;
  }
}

module.exports = async function maintenance(req, res, next) {
  try {
    if (!req.path.startsWith("/v1/") || OPEN.test(req.path)) return next();
    const m = (await siteSettings.get()).maintenance;
    if (!m?.enabled || (await isAdmin(req))) return next();
    if (m.until) {
      const secs = Math.ceil((Date.parse(m.until) - Date.now()) / 1000);
      if (secs > 0) res.set("Retry-After", String(secs));
    }
    return res.status(503).json({ code: 503, message: `MAINTENANCE: ${m.message || "We're doing some maintenance and will be back shortly."}`, data: { attributes: { maintenance: m } } });
  } catch (e) {
    return next();
  }
};
