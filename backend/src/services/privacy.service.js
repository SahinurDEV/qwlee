// GDPR-style data export and account erasure.
//
// Export: everything stored about one user, as JSON (private fields such as
// password hashes and 2FA secrets are left out by the models' toJSON).
// Erase: the account is anonymised rather than removed, because orders,
// payments and reviews are financial / other users' records. Personal data
// on the profile is cleared, sign-in is disabled, gigs are paused, and
// personal-only data (sessions, tokens, push, saved replies, favourites,
// notifications, activity, portfolio, open requests) is deleted.
const crypto = require("crypto");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const User = require("../models/user.model");
const M = (n) => mongoose.model(n);
require("../models");

// [model, owner fields, label]
const EXPORT = [
  ["Gig", ["userId"], "gigs"],
  ["Payment", ["clientId", "freelancerId"], "orders"],
  ["Review", ["userId", "freelancerId"], "reviews"],
  ["Message", ["sender", "receiver"], "messages"],
  ["Chat", ["participants"], "chats"],
  ["BuyerRequest", ["buyerId"], "buyerRequests"],
  ["RequestOffer", ["sellerId", "buyerId"], "requestOffers"],
  ["Withdrawal", ["userId"], "withdrawals"],
  ["Notification", ["receiverId"], "notifications"],
  ["SupportTicket", ["userId"], "supportTickets"],
  ["GigLove", ["userId"], "favourites"],
  ["Portfolio", ["userId"], "portfolio"],
  ["Subscription", ["buyerId", "sellerId"], "subscriptions"],
  ["Activity", ["userId"], "activity"],
  ["Session", ["user"], "sessions"],
  ["QuickReply", ["user"], "quickReplies"],
  ["Appeal", ["userId"], "appeals"],
];
const PER_COLLECTION = 5000;

async function exportUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  const out = { exportedAt: new Date().toISOString(), user: user.toJSON() };
  for (const [name, fields, label] of EXPORT) {
    let Model;
    try { Model = M(name); } catch { continue; }
    const q = { $or: fields.filter((f) => Model.schema.path(f)).map((f) => ({ [f]: user._id })) };
    if (!q.$or.length) continue;
    const docs = await Model.find(q).sort({ _id: -1 }).limit(PER_COLLECTION);
    out[label] = docs.map((d) => {
      const j = d.toJSON();
      if (name === "Session") delete j.tokenHash;
      return j;
    });
  }
  return out;
}

async function blockers(user) {
  const Payment = M("Payment");
  const open = await Payment.countDocuments({ $or: [{ clientId: user._id }, { freelancerId: user._id }], status: { $in: ["active", "late", "disputed"] }, isDeleted: { $ne: true } });
  const pendingW = await M("Withdrawal").countDocuments({ userId: user._id, status: { $in: ["Pending", "Processing"] } });
  const list = [];
  if (open) list.push(`${open} open order(s) must be completed or cancelled first`);
  if (pendingW) list.push(`${pendingW} withdrawal(s) are still being processed`);
  if (Number(user.balance) > 0) list.push(`withdraw your remaining balance ($${Number(user.balance).toFixed(2)}) first`);
  return list;
}

async function eraseUser(userId, { by = "self" } = {}) {
  const user = await User.findById(userId);
  if (!user || user.isDeleted) throw new ApiError(httpStatus.NOT_FOUND, "Account not found or already deleted");
  if (user.role === "admin") throw new ApiError(httpStatus.BAD_REQUEST, "Admin accounts can't be erased here; remove their admin role first");
  const b = await blockers(user);
  if (b.length) throw new ApiError(httpStatus.CONFLICT, `Can't delete the account yet: ${b.join("; ")}`);
  const id = String(user._id);
  const tag = id.slice(-8);
  Object.assign(user, {
    fullName: "Deleted user",
    email: `deleted-${id}@deleted.invalid`,
    username: `deleted-${tag}`,
    image: "",
    coverImage: "",
    location: "",
    intro: "",
    about: "",
    skills: [],
    googleId: undefined,
    password: crypto.randomBytes(24).toString("base64url") + "aA1!",
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorPending: null,
    twoFactorRecovery: [],
    notificationPrefs: undefined,
    referralCode: undefined,
    online: false,
    isDeleted: true,
    tokensValidAfter: new Date(),
  });
  if (user.verification) user.verification = undefined;
  await user.save({ validateBeforeSave: false });
  const del = async (name, q) => { try { return (await M(name).deleteMany(q)).deletedCount || 0; } catch { return 0; } };
  const removed = {
    sessions: await del("Session", { user: user._id }),
    tokens: await del("Token", { user: user._id }),
    push: await del("PushSubscription", { userId: user._id }),
    quickReplies: await del("QuickReply", { user: user._id }),
    favourites: await del("GigLove", { userId: user._id }),
    notifications: await del("Notification", { receiverId: user._id }),
    activity: await del("Activity", { userId: user._id }),
    portfolio: await del("Portfolio", { userId: user._id }),
    openRequests: await del("BuyerRequest", { buyerId: user._id, status: "open" }),
  };
  const gigs = await M("Gig").updateMany({ userId: user._id }, { $set: { gigStatus: "paused", featured: false } });
  await M("Subscription").updateMany({ $or: [{ buyerId: user._id }, { sellerId: user._id }], status: "active" }, { $set: { status: "cancelled" } }).catch(() => {});
  require("../config/logger").info(`account ${id} erased (by ${by})`);
  return { erased: true, userId: id, gigsPaused: gigs.modifiedCount || 0, removed };
}

module.exports = { exportUser, eraseUser, blockers };
