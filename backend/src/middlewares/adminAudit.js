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

// Five refused admin actions by the same account within 10 minutes is
// unusual (probing, or a compromised low-privilege admin): tell the
// super admins once per burst.
async function alertOnDenials(user) {
  const { AdminAudit, User, Notification } = require("../models");
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const n = await AdminAudit.countDocuments({ adminId: user._id || user.id, permission: /denied/, createdAt: { $gte: since } });
  if (n < 5) return;
  const already = await Notification.exists({ linkId: String(user._id || user.id), type: "announcement", role: "admin", createdAt: { $gte: since }, message: /was refused/ });
  if (already) return;
  const supers = await User.find({ role: "admin", $or: [{ adminRole: "super" }, { adminRole: null }, { adminRole: { $exists: false } }] }).select("_id").lean();
  await Notification.insertMany(
    supers.map((s) => ({
      receiverId: s._id,
      role: "admin",
      type: "announcement",
      message: `Security: ${user.email} was refused 5 admin actions in 10 minutes. Check the audit log.`,
      linkId: String(user._id || user.id),
    }))
  );
  logger.warn(`admin denial burst: ${user.email}`);
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
    })
      .then(() => (String(perm).includes("(denied)") ? alertOnDenials(req.user) : null))
      .catch((e) => logger.warn(`admin audit write failed: ${e.message}`));
  });
}

module.exports = { recordAdminAction, redact, alertOnDenials };
