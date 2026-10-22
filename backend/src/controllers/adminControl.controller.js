// Admin "full control" endpoints. Authorization (role + admin sub-role
// permission) and audit logging happen centrally in middlewares/auth.js
// via config/adminPermissions.js — every route here is auth("admin").
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const ApiError = require("../utils/ApiError");
const {
  User, Gig, Payment, Withdrawal, BuyerRequest, RequestOffer, Reviews, Notification, AdminAudit, Announcement, Categories, Dispute,
} = require("../models");
const siteSettings = require("../services/siteSettings.service");
const perms = require("../config/adminPermissions");

const ok = (res, data, message = "OK", code = httpStatus.OK) =>
  res.status(code).json(response({ message, status: "OK", statusCode: code, data }));
const oid = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid id");
  return new mongoose.Types.ObjectId(String(id));
};
const page = (q) => {
  const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
  const p = Math.max(Number(q.page) || 1, 1);
  return { limit, page: p, skip: (p - 1) * limit };
};
const rx = (s) => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80), "i");
const USER_FIELDS = "fullName username email role adminRole image isEmailVerified isBan banReason bannedUntil balance createdAt lastSeen online isVerified verificationStatus";
const list = async (Model, filter, q, { sort = { createdAt: -1 }, select, populate } = {}) => {
  const { limit, page: p, skip } = page(q);
  let query = Model.find(filter).sort(sort).skip(skip).limit(limit);
  if (select) query = query.select(select);
  for (const pop of populate || []) query = query.populate(...pop);
  const [results, total] = await Promise.all([query.lean({ virtuals: false }), Model.countDocuments(filter)]);
  return { results: results.map(({ _id, __v, password, ...r }) => ({ id: String(_id), ...r })), page: p, limit, totalResults: total, totalPages: Math.ceil(total / limit) };
};

// ---------------- users ----------------
const listUsers = catchAsync(async (req, res) => {
  const f = {};
  if (req.query.search) f.$or = [{ fullName: rx(req.query.search) }, { email: rx(req.query.search) }, { username: rx(req.query.search) }];
  if (["buyer", "freelancer", "admin"].includes(req.query.role)) f.role = req.query.role;
  if (req.query.status === "banned") f.isBan = true;
  if (req.query.status === "unverified") f.isEmailVerified = { $ne: true };
  ok(res, await list(User, f, req.query, { select: USER_FIELDS }));
});

const EDITABLE = ["fullName", "username", "email", "location", "intro", "about"];
const updateUser = catchAsync(async (req, res) => {
  const user = await User.findById(oid(req.params.userId));
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  if (user.role === "admin" && perms.roleOf(req.user) !== "super") throw new ApiError(httpStatus.FORBIDDEN, "Only super admins can edit admins");
  for (const k of EDITABLE) if (req.body?.[k] !== undefined) user[k] = String(req.body[k]).trim().slice(0, k === "about" ? 2000 : 200);
  if (req.body?.email !== undefined) {
    user.email = user.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid email");
    if (await User.exists({ email: user.email, _id: { $ne: user._id } })) throw new ApiError(httpStatus.CONFLICT, "Email already in use");
  }
  if (req.body?.username !== undefined && (await User.exists({ username: user.username, _id: { $ne: user._id } }))) {
    throw new ApiError(httpStatus.CONFLICT, "Username already taken");
  }
  if (req.body?.isEmailVerified !== undefined) user.isEmailVerified = !!req.body.isEmailVerified;
  await user.save();
  ok(res, { user }, "User updated");
});

// Role / admin sub-role changes are "settings" permission (super only).
const setRole = catchAsync(async (req, res) => {
  const { role, adminRole } = req.body || {};
  const user = await User.findById(oid(req.params.userId));
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  if (String(user._id) === String(req.user.id)) throw new ApiError(httpStatus.BAD_REQUEST, "You cannot change your own role");
  if (role !== undefined) {
    if (!["buyer", "freelancer", "admin"].includes(role)) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid role");
    if (user.role === "admin" && role !== "admin") {
      const supers = await User.countDocuments({ role: "admin", isBan: { $ne: true }, $or: [{ adminRole: "super" }, { adminRole: { $exists: false } }, { adminRole: null }] });
      if (perms.roleOf(user) === "super" && supers <= 1) throw new ApiError(httpStatus.BAD_REQUEST, "Cannot demote the last super admin");
    }
    user.role = role;
  }
  if (adminRole !== undefined) {
    if (!perms.ADMIN_ROLES.includes(adminRole)) throw new ApiError(httpStatus.BAD_REQUEST, `adminRole must be one of ${perms.ADMIN_ROLES.join(", ")}`);
    user.adminRole = adminRole;
  }
  if (user.role !== "admin") user.adminRole = undefined;
  else if (!user.adminRole) user.adminRole = "moderator";
  user.tokensValidAfter = new Date(); // re-login with the new rights
  await user.save();
  ok(res, { user }, "Role updated");
});

const resetPassword = catchAsync(async (req, res) => {
  const user = await User.findById(oid(req.params.userId));
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  const { generateOtp } = require("../utils/otp");
  const code = generateOtp();
  user.oneTimeCode = code;
  user.isResetPassword = true;
  await user.save();
  const sent = await require("../services/email.service").sendResetPasswordEmail(user.email, code);
  if (!sent) throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "Could not send the reset email (check SMTP settings)");
  ok(res, { sent: true }, "Password reset email sent");
});

const logoutEverywhere = catchAsync(async (req, res) => {
  const user = await User.findByIdAndUpdate(oid(req.params.userId), { $set: { tokensValidAfter: new Date() } }, { new: true });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  await require("../models").Token.deleteMany({ user: user._id });
  await require("../services/session.service").revokeOthers(user._id, null);
  ok(res, { ok: true }, "User signed out everywhere");
});
// Per-device sessions of a user (admin view + single revoke).
const userSessions = catchAsync(async (req, res) => {
  const s = require("../services/session.service");
  const rows = await s.list(oid(req.params.userId));
  ok(res, { results: rows.map((r) => s.view(r, req.user.$locals.sid)) });
});
const revokeUserSession = catchAsync(async (req, res) => {
  const done = await require("../services/session.service").revoke(oid(req.params.userId), String(req.params.sid), req.user._id);
  if (!done) throw new ApiError(httpStatus.NOT_FOUND, "Session not found");
  ok(res, { ok: true }, "Session signed out");
});

// Read-only "view as user": what the account sees, without logging in as
// them (no token is minted, nothing can be changed). Logged as a read.
const viewUser = catchAsync(async (req, res) => {
  const id = oid(req.params.userId);
  const user = await User.findById(id).select(`${USER_FIELDS} location intro about skills availability`).lean();
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  const [gigs, buying, selling, withdrawals, notifications, requests] = await Promise.all([
    Gig.find({ userId: id }).select("title slug gigStatus featured price images createdAt").sort({ createdAt: -1 }).limit(50).lean(),
    Payment.find({ clientId: id }).select("status price escrow createdAt gigId freelancerId").populate("gigId", "title").sort({ createdAt: -1 }).limit(50).lean(),
    Payment.find({ freelancerId: id }).select("status price escrow sellerEarning createdAt gigId clientId").populate("gigId", "title").sort({ createdAt: -1 }).limit(50).lean(),
    Withdrawal.find({ userId: id }).sort({ createdAt: -1 }).limit(20).lean(),
    Notification.find({ $or: [{ receiverId: id }, { userId: id }] }).sort({ createdAt: -1 }).limit(20).lean(),
    BuyerRequest.find({ buyerId: id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  ok(res, { user: { id: String(user._id), ...user }, gigs, buying, selling, withdrawals, notifications, requests });
});

// ---------------- gigs ----------------
const featureGig = catchAsync(async (req, res) => {
  const gig = await Gig.findByIdAndUpdate(oid(req.params.gigId), { $set: { featured: !!req.body?.featured } }, { new: true });
  if (!gig) throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  ok(res, { gig }, gig.featured ? "Gig featured" : "Gig unfeatured");
});
const editGig = catchAsync(async (req, res) => {
  const gigService = require("../services/gig.service");
  const allowed = ["title", "description", "tags", "package", "categoriesId", "subCategoryId", "images", "faq", "extras", "requirementQuestions", "video"];
  const data = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
  if (typeof data.description === "string") data.description = require("sanitize-html")(require("he").decode(data.description));
  const gig = await gigService.updateGigById(String(oid(req.params.gigId)), data, undefined, req.user);
  ok(res, { gig }, "Gig updated");
});

// ---------------- orders / escrow ----------------
const getOrder = catchAsync(async (req, res) => {
  const order = await Payment.findById(oid(req.params.orderId))
    .populate("clientId", "fullName email username")
    .populate("freelancerId", "fullName email username")
    .populate("gigId", "title slug")
    .lean();
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  const disputes = await Dispute.find({ orderId: order._id }).select("status reason createdAt resolution").lean().catch(() => []);
  ok(res, { order: { id: String(order._id), ...order }, disputes });
});
const refundOrder = catchAsync(async (req, res) => {
  const adminService = require("../services/admin.service");
  const reason = String(req.body?.reason || "").trim() || "Refunded by admin";
  const before = await Payment.findById(oid(req.params.orderId));
  if (!before) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  if (before.escrow?.status === "refunded" && before.escrow?.refund?.status !== "failed") throw new ApiError(httpStatus.CONFLICT, "Order is already refunded");
  let order = before;
  if (before.status !== "cancelled") order = await adminService.cancelOrder(before._id, { reason: `Refund: ${reason}`, adminId: req.user.id });
  // cancelOrder already reversed any seller credit; mark escrow refunded.
  const lifecycle = require("../services/orderLifecycle.service");
  await lifecycle.refundEscrow(before._id); // no-op if cancel already refunded
  await Payment.updateOne({ _id: before._id }, { $set: { refundReason: reason.slice(0, 500) } });
  // Retry a previously failed provider refund.
  const refund = await require("../services/refunds.service").issueRefund(before._id);
  order = await Payment.findById(before._id);
  const note = refund?.status === "failed"
    ? `Escrow refunded but the ${refund.provider} refund failed: ${refund.error}. Retry from this page.`
    : refund?.provider === "stripe" ? `Card refund ${refund.status} in Stripe (${refund.id}).` : "Escrow refunded (demo payment, no card charged).";
  ok(res, { order, refund, note }, "Order refunded");
});
const refundTip = catchAsync(async (req, res) => {
  const r = await require("../services/refunds.service").refundTip(oid(req.params.orderId), String(req.params.tipId), req.body?.reason || "");
  if (r.error) throw new ApiError(r.code, r.error);
  const note = r.refund.status === "failed" ? `Seller debited $${r.sellerDebited}, but the ${r.refund.provider} refund failed: ${r.refund.error}. Retry.` : `Tip refunded (${r.refund.provider}); seller debited $${r.sellerDebited}.`;
  ok(res, { ...r, order: await Payment.findById(oid(req.params.orderId)) }, note);
});
const forceComplete = catchAsync(async (req, res) => {
  const lifecycle = require("../services/orderLifecycle.service");
  const order = await Payment.findById(oid(req.params.orderId));
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  const done = await lifecycle.completeOrder(order, { reason: "admin", fromStatuses: ["active", "late", "disputed"] });
  ok(res, { order: done }, "Order completed and escrow released");
});
const escrowSummary = catchAsync(async (req, res) => {
  const rows = await Payment.aggregate([
    { $group: { _id: { $ifNull: ["$escrow.status", "none"] }, count: { $sum: 1 }, amount: { $sum: { $ifNull: ["$escrow.amount", "$price"] } }, fees: { $sum: { $ifNull: ["$platformFee", 0] } } } },
  ]);
  const pendingWithdrawals = await Withdrawal.aggregate([{ $match: { status: "Pending" } }, { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$withdrawalAmount" } } }]);
  const sellerBalances = await User.aggregate([{ $match: { role: "freelancer" } }, { $group: { _id: null, total: { $sum: "$balance" } } }]);
  ok(res, {
    escrow: Object.fromEntries(rows.map((r) => [r._id, { count: r.count, amount: Math.round(r.amount * 100) / 100, fees: Math.round(r.fees * 100) / 100 }])),
    pendingWithdrawals: pendingWithdrawals[0] || { count: 0, amount: 0 },
    sellerBalances: sellerBalances[0]?.total || 0,
  });
});
const listPayments = catchAsync(async (req, res) => {
  const f = {};
  if (req.query.status) f.status = req.query.status;
  if (req.query.escrow) f["escrow.status"] = req.query.escrow;
  ok(res, await list(Payment, f, req.query, {
    select: "status price escrow platformFee sellerEarning provider createdAt gigId clientId freelancerId tips",
    populate: [["gigId", "title"], ["clientId", "fullName email"], ["freelancerId", "fullName email"]],
  }));
});

// ---------------- moderation ----------------
const listRequests = catchAsync(async (req, res) => {
  const f = {};
  if (req.query.status) f.status = req.query.status;
  if (req.query.search) f.title = rx(req.query.search);
  ok(res, await list(BuyerRequest, f, req.query, { populate: [["buyerId", "fullName email"]] }));
});
const moderateRequest = catchAsync(async (req, res) => {
  const status = req.body?.status;
  if (!["open", "closed"].includes(status)) throw new ApiError(httpStatus.BAD_REQUEST, "status must be open or closed");
  const doc = await BuyerRequest.findByIdAndUpdate(oid(req.params.requestId), { $set: { status } }, { new: true });
  if (!doc) throw new ApiError(httpStatus.NOT_FOUND, "Request not found");
  ok(res, { request: doc }, "Request updated");
});
const deleteRequest = catchAsync(async (req, res) => {
  const id = oid(req.params.requestId);
  const doc = await BuyerRequest.findById(id);
  if (!doc) throw new ApiError(httpStatus.NOT_FOUND, "Request not found");
  if (await RequestOffer.exists({ requestId: id, status: "accepted" })) throw new ApiError(httpStatus.CONFLICT, "A request with an accepted offer can only be closed");
  await RequestOffer.deleteMany({ requestId: id });
  await doc.deleteOne();
  ok(res, { deleted: true }, "Request deleted");
});
const listOffers = catchAsync(async (req, res) => {
  const f = {};
  if (req.query.status) f.status = req.query.status;
  if (req.query.requestId) f.requestId = oid(req.query.requestId);
  ok(res, await list(RequestOffer, f, req.query, { populate: [["sellerId", "fullName email"], ["requestId", "title"]] }));
});
const removeOffer = catchAsync(async (req, res) => {
  const offer = await RequestOffer.findById(oid(req.params.offerId));
  if (!offer) throw new ApiError(httpStatus.NOT_FOUND, "Offer not found");
  if (offer.status === "accepted") throw new ApiError(httpStatus.CONFLICT, "Accepted offers are orders now; cancel the order instead");
  await offer.deleteOne();
  ok(res, { deleted: true }, "Offer removed");
});
const listReviews = catchAsync(async (req, res) => {
  const f = {};
  if (req.query.maxRating) f.rating = { $lte: Number(req.query.maxRating) };
  if (req.query.search) f.review = rx(req.query.search);
  ok(res, await list(Reviews, f, req.query, { populate: [["userId", "fullName email"], ["freelancerId", "fullName"], ["gigId", "title"]] }));
});
const deleteReview = catchAsync(async (req, res) => {
  const doc = await Reviews.findByIdAndDelete(oid(req.params.reviewId));
  if (!doc) throw new ApiError(httpStatus.NOT_FOUND, "Review not found");
  require("../services/gigStats.service").recomputeLater(doc.gigId);
  ok(res, { deleted: true }, "Review removed");
});

// ---------------- settings ----------------
const getSite = catchAsync(async (req, res) => ok(res, { site: await siteSettings.get() }));
const updateSite = catchAsync(async (req, res) => {
  const patch = req.body || {};
  if (patch.security) {
    // Don't let an admin lock themselves (and everyone on this network) out.
    const next = siteSettings.normalise({ ...(await siteSettings.get()), security: { ...(await siteSettings.get()).security, ...patch.security } });
    if (!require("../utils/ipMatch").allowed(req.ip, next.security.adminIpAllowlist)) {
      throw new ApiError(httpStatus.BAD_REQUEST, `The allowlist must include your current address (${require("../utils/ipMatch").norm(req.ip)})`);
    }
    if (next.security.requireAdmin2fa && !req.user.twoFactorEnabled) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Turn on two-factor for your own account before requiring it for all admins");
    }
  }
  ok(res, { site: await siteSettings.update(patch) }, "Settings saved");
});
const publicSite = catchAsync(async (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  ok(res, await siteSettings.getPublic());
});

// ---------------- broadcast ----------------
const broadcast = catchAsync(async (req, res) => {
  const title = String(req.body?.title || "").trim().slice(0, 120);
  const message = String(req.body?.message || "").trim().slice(0, 2000);
  const audience = ["all", "buyers", "sellers"].includes(req.body?.audience) ? req.body.audience : "all";
  const link = String(req.body?.link || "").trim().slice(0, 300);
  if (!title || !message) throw new ApiError(httpStatus.BAD_REQUEST, "Title and message are required");
  if (link && !/^(https?:\/\/|\/)/.test(link)) throw new ApiError(httpStatus.BAD_REQUEST, "Link must be a URL or a /path");
  const roleFilter = audience === "buyers" ? { role: "buyer" } : audience === "sellers" ? { role: "freelancer" } : { role: { $in: ["buyer", "freelancer"] } };
  const users = await User.find({ ...roleFilter, isBan: { $ne: true } }).select("_id email fullName role").lean();
  await Notification.insertMany(users.map((u) => ({ receiverId: u._id, role: u.role, type: "announcement", message: `${title}: ${message}`.slice(0, 2000), linkId: link })));
  try {
    const { io } = require("../socket/socketServer");
    for (const u of users) io.emit(`${u.role === "buyer" ? "buyer" : "freelancer"}-notification::${u._id}`, { message: "Announcement", data: { title, message, link } });
  } catch { /* socket optional */ }
  let emailed = 0;
  if (req.body?.sendEmail) {
    const e = require("../services/email.service");
    for (const u of users.slice(0, 2000)) {
      if (u.email && (await e.sendAnnouncement(u.email, { recipientName: u.fullName, title, message, link }))) emailed++;
    }
  }
  const doc = await Announcement.create({ title, message, audience, link, sendEmail: !!req.body?.sendEmail, recipients: users.length, emailed, createdBy: req.user.id });
  ok(res, { announcement: doc }, `Sent to ${users.length} users`, httpStatus.CREATED);
});
const listBroadcasts = catchAsync(async (req, res) => ok(res, await list(Announcement, {}, req.query, { populate: [["createdBy", "fullName email"]] })));

// ---------------- analytics ----------------
const analytics = catchAsync(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 365);
  const since = new Date(Date.now() - days * 86400000);
  const day = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
  const [signups, orders, gigs, topCategories, statusMix] = await Promise.all([
    User.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { d: day, r: "$role" }, n: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: day, n: { $sum: 1 }, gmv: { $sum: { $ifNull: ["$price", 0] } }, fees: { $sum: { $ifNull: ["$platformFee", 0] } } } }]),
    Gig.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: day, n: { $sum: 1 } } }]),
    Payment.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $lookup: { from: "gigs", localField: "gigId", foreignField: "_id", as: "g" } },
      { $unwind: "$g" },
      { $group: { _id: "$g.categoriesId", orders: { $sum: 1 }, gmv: { $sum: { $ifNull: ["$price", 0] } } } },
      { $sort: { gmv: -1 } },
      { $limit: 8 },
    ]),
    Payment.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const cats = await Categories.find({ _id: { $in: topCategories.map((c) => c._id).filter(Boolean) } }).select("name").lean();
  const catName = Object.fromEntries(cats.map((c) => [String(c._id), c.name]));
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const o = orders.find((x) => x._id === d);
    series.push({
      date: d,
      buyers: signups.find((x) => x._id.d === d && x._id.r === "buyer")?.n || 0,
      sellers: signups.find((x) => x._id.d === d && x._id.r === "freelancer")?.n || 0,
      orders: o?.n || 0,
      gmv: Math.round((o?.gmv || 0) * 100) / 100,
      fees: Math.round((o?.fees || 0) * 100) / 100,
      gigs: gigs.find((x) => x._id === d)?.n || 0,
    });
  }
  const sum = (k) => Math.round(series.reduce((a, r) => a + r[k], 0) * 100) / 100;
  ok(res, {
    days,
    totals: { signups: sum("buyers") + sum("sellers"), orders: sum("orders"), gmv: sum("gmv"), fees: sum("fees"), gigs: sum("gigs") },
    series,
    topCategories: topCategories.map((c) => ({ name: catName[String(c._id)] || "Uncategorised", orders: c.orders, gmv: Math.round(c.gmv * 100) / 100 })),
    statusMix: Object.fromEntries(statusMix.map((s) => [s._id, s.n])),
  });
});

// ---------------- two-factor (own account) ----------------
const twoFactor = require("../services/twoFactor.service");
const twoFaStatus = catchAsync(async (req, res) => ok(res, { enabled: !!req.user.twoFactorEnabled, recoveryLeft: (await User.findById(req.user._id).select("+twoFactorRecovery").lean())?.twoFactorRecovery?.length || 0 }));
const twoFaSetup = catchAsync(async (req, res) => {
  if (req.user.twoFactorEnabled) throw new ApiError(httpStatus.CONFLICT, "Two-factor is already on");
  ok(res, await twoFactor.setup(req.user._id));
});
const twoFaEnable = catchAsync(async (req, res) => ok(res, await twoFactor.enable(req.user._id, req.body?.code), "Two-factor is on"));
const twoFaDisable = catchAsync(async (req, res) => {
  const sec = (await siteSettings.get()).security;
  if (sec.requireAdmin2fa) throw new ApiError(httpStatus.BAD_REQUEST, "Two-factor is required for admins on this site");
  const full = await User.findById(req.user._id).select("+twoFactorSecret +twoFactorRecovery +twoFactorLastStep");
  await twoFactor.disable(full, req.body?.code);
  ok(res, { enabled: false }, "Two-factor is off");
});
const twoFaReset = catchAsync(async (req, res) => {
  const target = await User.findById(oid(req.params.id));
  if (!target || target.role !== "admin") throw new ApiError(httpStatus.NOT_FOUND, "Admin not found");
  if (String(target._id) === String(req.user._id)) throw new ApiError(httpStatus.BAD_REQUEST, "Use your own security settings");
  await twoFactor.reset(target._id);
  await User.updateOne({ _id: target._id }, { $set: { tokensValidAfter: new Date() } });
  ok(res, { id: String(target._id) }, "Two-factor reset; the admin was signed out");
});

// ---------------- audit + team ----------------
const auditLog = catchAsync(async (req, res) => {
  const f = {};
  if (req.query.adminId) f.adminId = oid(req.query.adminId);
  if (req.query.targetId) f.targetId = String(req.query.targetId);
  if (req.query.search) f.action = rx(req.query.search);
  if (req.query.denied === "true") f.permission = /denied/;
  if (req.query.from || req.query.to) {
    f.createdAt = {};
    if (req.query.from) f.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) f.createdAt.$lte = new Date(req.query.to);
  }
  if (req.query.format === "csv") {
    const rows = await AdminAudit.find(f).sort({ createdAt: -1 }).limit(50000).lean();
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["time,admin,role,action,target,permission,status,ip,body"]
      .concat(rows.map((r) => [r.createdAt?.toISOString(), r.adminEmail, r.adminRole, r.action, r.targetId, r.permission, r.status, r.ip, JSON.stringify(r.body || {})].map(esc).join(",")))
      .join("\n");
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="admin-audit.csv"');
    return res.send(csv);
  }
  ok(res, await list(AdminAudit, f, req.query));
});
const team = catchAsync(async (req, res) => {
  const admins = await User.find({ role: "admin" }).select("fullName email username adminRole isBan lastSeen createdAt twoFactorEnabled").lean();
  const { Activity } = require("../models");
  const logins = Activity
    ? await Activity.find({ type: "login", userId: { $in: admins.map((a) => a._id) } }).sort({ createdAt: -1 }).limit(30).lean()
    : [];
  const nameOf = Object.fromEntries(admins.map((a) => [String(a._id), a.fullName || a.email]));
  ok(res, {
    admins: admins.map(({ _id, ...a }) => ({ id: String(_id), ...a, adminRole: a.adminRole || "super" })),
    logins: logins.map((l) => ({ id: String(l._id), adminId: String(l.userId), admin: nameOf[String(l.userId)], ip: l.ip, userAgent: l.userAgent, at: l.createdAt })),
    roles: perms.ROLE_PERMISSIONS,
    me: { id: String(req.user._id), adminRole: perms.roleOf(req.user) },
  });
});
// ---------------- newsletter ----------------
const listSubscribers = catchAsync(async (req, res) => {
  const { Subscriber } = require("../models");
  const f = {};
  if (req.query.status) f.status = String(req.query.status);
  if (req.query.search) f.email = rx(req.query.search);
  if (req.query.format === "csv") {
    const rows = await Subscriber.find(f).sort({ createdAt: -1 }).limit(50000).lean();
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["email,status,source,subscribed_at"]
      .concat(rows.map((r) => [r.email, r.status, r.source, r.createdAt?.toISOString()].map(esc).join(",")))
      .join("\n");
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="subscribers.csv"');
    return res.send(csv);
  }
  ok(res, await list(Subscriber, f, req.query));
});

const me = catchAsync(async (req, res) => {
  const role = perms.roleOf(req.user);
  ok(res, { id: String(req.user._id), adminRole: role, permissions: perms.ROLE_PERMISSIONS[role] });
});

const storageOrphans = catchAsync(async (req, res) => {
  const r = await require("../services/uploadsCleanup.service").run({ apply: req.method === "POST", minAgeHours: 24 });
  ok(res, r, req.method === "POST" ? `Deleted ${r.deleted} unused file(s)` : "Scan complete");
});

module.exports = {
  refundTip,
  userSessions, revokeUserSession,
  storageOrphans,
  listUsers, updateUser, setRole, resetPassword, logoutEverywhere, viewUser,
  featureGig, editGig, getOrder, refundOrder, forceComplete, escrowSummary, listPayments,
  listRequests, moderateRequest, deleteRequest, listOffers, removeOffer, listReviews, deleteReview,
  getSite, updateSite, publicSite, broadcast, listBroadcasts, analytics, auditLog, team, me, twoFaStatus, twoFaSetup, twoFaEnable, twoFaDisable, twoFaReset,
  listSubscribers,
};
