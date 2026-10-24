// Warnings, restrictions and the escalation ladder (Fiverr-style).
//
//   warning      explains the problem; expires after warningExpiryDays
//   escalation   the Nth active warning of the same reason
//                (suspendAfterSameReason) or the Nth active warning
//                overall (suspendAfterTotal) applies `escalateTo`:
//                "restrict" (default) or "suspend"
//   restricted   can finish orders in progress, deliver, chat on those
//                orders and withdraw; cannot publish gigs, send offers,
//                start new conversations or receive new orders. Gigs are
//                paused. After restrictionDays the account is suspended.
//
// All numbers are admin settings (Settings > Trust & safety).
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { User, Warning, Gig, Notification } = require("../models");
const siteSettings = require("./siteSettings.service");

const LABEL = {
  off_platform: "Taking communication or payment off Qwlee",
  spam: "Spam or unsolicited messages",
  harassment: "Abusive or disrespectful behaviour",
  prohibited_service: "Offering a prohibited service",
  fake_reviews: "Review manipulation",
  ip: "Intellectual property infringement",
  misleading: "Misleading gig or profile",
  other: "Breaking the Community Standards",
};

async function rules() {
  return (await siteSettings.get()).trust;
}

const notify = (userId, message) => Notification.create({ receiverId: userId, message, linkId: "community-standards", role: "buyer" }).catch(() => null);
const email = async (userId, subject, html) => {
  const u = await User.findById(userId, "email fullName username").lean();
  if (u?.email) require("./email.service").sendEmail(u.email, subject, html)?.catch?.(() => {});
};
const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function active(userId, now = new Date()) {
  return Warning.find({ userId, revokedAt: null, expiresAt: { $gt: now } }).sort({ createdAt: -1 }).lean();
}

async function issueWarning(userId, { reason, note = "", issuedBy = null, source = "admin" } = {}) {
  if (!Warning.REASONS.includes(reason)) throw new ApiError(httpStatus.BAD_REQUEST, `reason must be one of ${Warning.REASONS.join(", ")}`);
  const user = await User.findById(userId);
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  if (user.role === "admin") throw new ApiError(httpStatus.FORBIDDEN, "Admins cannot be warned");
  const r = await rules();
  const w = await Warning.create({ userId, reason, note: String(note).slice(0, 1000), issuedBy, source, expiresAt: new Date(Date.now() + r.warningExpiryDays * 86400000) });
  const list = await active(userId);
  const same = list.filter((x) => x.reason === reason).length;
  let escalation = "";
  if ((r.suspendAfterSameReason > 0 && same >= r.suspendAfterSameReason) || (r.suspendAfterTotal > 0 && list.length >= r.suspendAfterTotal)) {
    escalation = r.escalateTo === "suspend" ? "suspended" : "restricted";
  }
  await notify(userId, `Warning: ${LABEL[reason]}. Please review the Community Standards.`);
  await email(userId, "A warning on your Qwlee account", `<p>We issued a warning on your account for: <b>${esc(LABEL[reason])}</b>.</p>${note ? `<p>${esc(note)}</p>` : ""}<p>Warnings expire after ${r.warningExpiryDays} days. Repeated problems can lead to restriction or suspension. Please read our Community Standards.</p>`);
  if (escalation === "suspended") {
    await require("./admin.service").banUser(userId, { reason: `Suspended after repeated policy warnings (${LABEL[reason]}).` });
  } else if (escalation === "restricted" && !user.restriction?.active) {
    await restrict(userId, { reason: `Repeated policy warnings (${LABEL[reason]}).`, by: issuedBy });
  }
  if (escalation) await Warning.updateOne({ _id: w._id }, { $set: { escalation } });
  return { warning: { ...w.toObject(), escalation }, active: list.length, escalation };
}

async function revokeWarning(id) {
  const w = await Warning.findOneAndUpdate({ _id: id, revokedAt: null }, { $set: { revokedAt: new Date() } }, { new: true });
  if (!w) throw new ApiError(httpStatus.NOT_FOUND, "Warning not found or already revoked");
  return w;
}

async function listWarnings(userId) {
  const all = await Warning.find({ userId }).sort({ createdAt: -1 }).limit(100).populate("issuedBy", "fullName").lean();
  const now = new Date();
  const user = await User.findById(userId, "restriction isBan").lean();
  return {
    results: all.map((w) => ({ ...w, id: String(w._id), label: LABEL[w.reason], active: !w.revokedAt && new Date(w.expiresAt) > now })),
    restriction: user?.restriction?.active ? user.restriction : null,
    reasons: Warning.REASONS.map((r) => ({ value: r, label: LABEL[r] })),
  };
}

async function restrict(userId, { reason = "", days, by = null } = {}) {
  const r = await rules();
  const d = Number(days) || r.restrictionDays;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  if (user.role === "admin") throw new ApiError(httpStatus.FORBIDDEN, "Admins cannot be restricted");
  const until = new Date(Date.now() + d * 86400000);
  await User.updateOne({ _id: userId }, { $set: { restriction: { active: true, reason: String(reason || "Community Standards violation").slice(0, 500), since: new Date(), until, by } } });
  // Pause live gigs, remembering which ones so a lift can restore them.
  await Gig.updateMany({ userId, gigStatus: "active" }, { $set: { gigStatus: "paused", pausedByRestriction: true } });
  await notify(userId, `Your account is restricted until ${until.toISOString().slice(0, 10)}. You can finish current orders and withdraw cleared earnings.`);
  await email(userId, "Your Qwlee account is restricted", `<p>Your account has been restricted: ${esc(reason)}</p><p>You can still finish and deliver orders already in progress, message buyers on those orders, and withdraw cleared earnings. You cannot publish gigs, send offers, start new conversations or receive new orders. Unless the restriction is lifted, the account will be suspended on ${until.toISOString().slice(0, 10)}.</p><p>If you think this is a mistake, contact support.</p>`);
  return { until };
}

async function liftRestriction(userId) {
  const r = await User.updateOne({ _id: userId, "restriction.active": true }, { $set: { "restriction.active": false, "restriction.liftedAt": new Date() } });
  if (!r.modifiedCount) throw new ApiError(httpStatus.BAD_REQUEST, "This account is not restricted");
  await Gig.updateMany({ userId, pausedByRestriction: true }, { $set: { gigStatus: "active" }, $unset: { pausedByRestriction: 1 } });
  await notify(userId, "The restriction on your account was lifted.");
  return { ok: true };
}

/** Throws when a restricted user tries to take on new work. */
async function assertNotRestricted(userId, what = "do this") {
  const u = await User.findById(userId, "restriction").lean();
  if (u?.restriction?.active) throw new ApiError(httpStatus.FORBIDDEN, `Your account is restricted, so you can't ${what}. You can still finish your current orders.`);
}

/** Housekeeping: restrictions past their end date become suspensions. */
async function expireRestrictions(now = new Date()) {
  const due = await User.find({ "restriction.active": true, "restriction.until": { $lte: now } }, "_id restriction").limit(100);
  let n = 0;
  for (const u of due) {
    const claimed = await User.updateOne({ _id: u._id, "restriction.active": true }, { $set: { "restriction.active": false, "restriction.endedAt": now } });
    if (!claimed.modifiedCount) continue;
    await require("./admin.service").banUser(u._id, { reason: `Account suspended at the end of a restriction: ${u.restriction.reason || "policy violations"}` }).catch(() => null);
    n += 1;
  }
  return n;
}

module.exports = { issueWarning, revokeWarning, listWarnings, restrict, liftRestriction, assertNotRestricted, expireRestrictions, active, LABEL };
