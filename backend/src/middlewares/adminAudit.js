// Records an admin action once the response is sent. Secrets in the
// request body are redacted; long strings are truncated.
const logger = require("../config/logger");

const SECRET = /pass|secret|token|key|credential|otp|code/i;
function redact(v, depth = 0) {
  if (depth > 4) return "[…]";
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => redact(x, depth + 1));
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, x] of Object.entries(v).slice(0, 40)) out[k] = SECRET.test(k) ? "[redacted]" : redact(x, depth + 1);
    return out;
  }
  if (typeof v === "string" && v.length > 300) return v.slice(0, 300) + "…";
  return v;
}

function recordAdminAction(req, res, { perm, path }) {
  res.on("finish", () => {
    const { AdminAudit } = require("../models");
    const action = `${req.method} ${path.replace(/[a-f0-9]{24}/gi, ":id")}`;
    const target = (path.match(/[a-f0-9]{24}/i) || [""])[0];
    AdminAudit.create({
      adminId: req.user._id || req.user.id,
      adminEmail: req.user.email,
      adminRole: req.user.adminRole || "super",
      action,
      method: req.method,
      path,
      targetId: target,
      permission: perm,
      body: redact(req.body || {}),
      status: res.statusCode,
      ok: res.statusCode < 400,
      ip: req.ip,
    }).catch((e) => logger.warn(`admin audit write failed: ${e.message}`));
  });
}

module.exports = { recordAdminAction, redact };
