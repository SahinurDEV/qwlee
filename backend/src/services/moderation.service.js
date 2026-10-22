// Temporary bans, ban appeals and bulk admin actions.
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const { User, Appeal, Gig } = require("../models");

// Lift a temporary ban whose time is up. Mutates and saves `user`.
async function liftIfExpired(user) {
  if (!user?.isBan || !user.bannedUntil || new Date(user.bannedUntil) > new Date()) return false;
  const r = await User.updateOne({ _id: user._id, isBan: true, bannedUntil: user.bannedUntil }, { $set: { isBan: false, banReason: "", bannedAt: null, bannedUntil: null } });
  user.isBan = false;
  user.banReason = "";
  user.bannedAt = null;
  user.bannedUntil = null;
  return r.modifiedCount > 0;
}

// Housekeeping: lift every expired temporary ban.
async function liftExpiredBans(now = new Date()) {
  const r = await User.updateMany({ isBan: true, bannedUntil: { $ne: null, $lte: now } }, { $set: { isBan: false, banReason: "", bannedAt: null, bannedUntil: null } });
  return r.modifiedCount;
}

// A banned user appeals. The refused sign-in hands them a 30-minute appeal
// token (they can't get an access token), so no password is sent again.
const jwt = require("jsonwebtoken");
const config = require("../config/config");
function appealToken(userId) {
  return jwt.sign({ sub: String(userId), type: "appeal" }, config.jwt.secret, { expiresIn: "30m" });
}
async function createAppeal(token, message) {
  let sub;
  try {
    const p = jwt.verify(String(token || ""), config.jwt.secret);
    if (p.type !== "appeal") throw new Error("wrong type");
    sub = p.sub;
  } catch {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Your appeal link has expired. Try signing in again to appeal.");
  }
  const text = String(message || "").trim().slice(0, 2000);
  if (text.length < 20) throw new ApiError(httpStatus.BAD_REQUEST, "Please explain in at least 20 characters");
  const user = await User.findById(sub);
  if (!user) throw new ApiError(httpStatus.UNAUTHORIZED, "Account not found");
  await liftIfExpired(user);
  if (!user.isBan) throw new ApiError(httpStatus.BAD_REQUEST, "This account is not suspended");
  const open = await Appeal.findOne({ userId: user._id, status: "open" });
  if (open) throw new ApiError(httpStatus.CONFLICT, "You already have an appeal waiting for review");
  const refused = await Appeal.countDocuments({ userId: user._id, status: "rejected", createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } });
  if (refused >= 3) throw new ApiError(httpStatus.TOO_MANY_REQUESTS, "Three appeals were turned down this week; try again later");
  const a = await Appeal.create({ userId: user._id, message: text, banReason: user.banReason || "" });
  return { id: a.id, status: a.status, createdAt: a.createdAt };
}

async function listAppeals({ status = "open", page = 1 } = {}) {
  const filter = status && status !== "all" ? { status } : {};
  return Appeal.paginate(filter, { sortBy: "createdAt:desc", page: Number(page) || 1, limit: 50, populate: [{ path: "userId", select: "fullName email username image isBan bannedUntil" }, { path: "decidedBy", select: "fullName" }] });
}

async function decideAppeal(id, { decision, reply }, admin) {
  if (!["accepted", "rejected"].includes(decision)) throw new ApiError(httpStatus.BAD_REQUEST, "decision must be accepted or rejected");
  const a = await Appeal.findOneAndUpdate(
    { _id: id, status: "open" },
    { $set: { status: decision, reply: String(reply || "").slice(0, 2000), decidedBy: admin._id, decidedAt: new Date() } },
    { new: true }
  );
  if (!a) throw new ApiError(httpStatus.CONFLICT, "Appeal not found or already decided");
  const user = await User.findById(a.userId);
  if (decision === "accepted" && user) await require("./admin.service").unbanUser(user._id);
  if (user?.email) {
    const accepted = decision === "accepted";
    const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    require("./email.service")
      .sendEmail(
        user.email,
        accepted ? "Your appeal was accepted" : "Your appeal was reviewed",
        `<p>Hi ${esc(user.fullName || user.username || "there")},</p><p>${accepted ? "We reviewed your appeal and lifted the suspension. You can sign in again." : "We reviewed your appeal and the suspension stays in place."}</p>${a.reply ? `<p>${esc(a.reply)}</p>` : ""}`
      )
      ?.catch?.(() => {});
  }
  return a;
}

const MAX = 200;
const ids = (list) => {
  if (!Array.isArray(list) || !list.length) throw new ApiError(httpStatus.BAD_REQUEST, "ids must be a non-empty array");
  if (list.length > MAX) throw new ApiError(httpStatus.BAD_REQUEST, `At most ${MAX} at a time`);
  return [...new Set(list.map(String))].filter((x) => mongoose.isValidObjectId(x));
};

// Bulk user actions: ban (reason, days), unban, logout.
async function bulkUsers(list, { action, reason, days }, admin) {
  const adminService = require("./admin.service");
  const results = [];
  for (const id of ids(list)) {
    try {
      if (String(id) === String(admin._id)) throw new Error("You cannot act on yourself");
      if (action === "ban") await adminService.banUser(id, { reason, days });
      else if (action === "unban") await adminService.unbanUser(id);
      else if (action === "logout") {
        const u = await User.findById(id);
        if (!u) throw new Error("User not found");
        if (u.role === "admin") throw new Error("Use the team page for admins");
        await User.updateOne({ _id: id }, { $set: { tokensValidAfter: new Date() } });
      } else throw new ApiError(httpStatus.BAD_REQUEST, "action must be ban, unban or logout");
      results.push({ id, ok: true });
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === httpStatus.BAD_REQUEST && /action must|days must/.test(e.message)) throw e;
      results.push({ id, ok: false, error: e.message });
    }
  }
  return { done: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
}

const GIG_STATUSES = ["active", "pending", "requires-modification", "draft", "denied", "paused"];
// Bulk gig actions: set status (with a reason shown to the seller), feature, unfeature.
async function bulkGigs(list, { action, status, reason }, admin) {
  const clean = ids(list);
  let update;
  if (action === "status") {
    if (!GIG_STATUSES.includes(status)) throw new ApiError(httpStatus.BAD_REQUEST, `status must be one of: ${GIG_STATUSES.join(", ")}`);
    update = { gigStatus: status, moderation: { reason: String(reason || "").slice(0, 500), reviewedBy: admin._id, reviewedAt: new Date() } };
  } else if (action === "feature" || action === "unfeature") update = { featured: action === "feature" };
  else throw new ApiError(httpStatus.BAD_REQUEST, "action must be status, feature or unfeature");
  const r = await Gig.updateMany({ _id: { $in: clean }, isDeleted: { $ne: true } }, { $set: update });
  return { matched: r.matchedCount, modified: r.modifiedCount };
}

module.exports = { appealToken, liftIfExpired, liftExpiredBans, createAppeal, listAppeals, decideAppeal, bulkUsers, bulkGigs };
