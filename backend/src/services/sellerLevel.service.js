// Seller levels — Fiverr-style.
//
//   computeLevelOverview(userId)  current level, metrics and progress to
//                                 the next level (seller dashboard).
//   evaluate(userId)              recompute and store user.sellerLevel, the
//                                 single source for badges and filters.
//   evaluateAll()                 housekeeping: re-evaluate stale sellers.
//   listMyGigsWithStats(userId)   per-gig stats for the seller's gig list.
//
// Tiers live in AppConfig.sellerLevels (admin: /dashboard/seller-levels).
// Defaults follow Fiverr's published criteria. A tier with
// requiresApproval (Top Rated) is only granted once an admin approves.

const mongoose = require("mongoose");
const { Gig, Payment, User } = require("../models");

const DEFAULT_LEVEL_TIERS = [
  { id: "level0", label: "New seller", minOrders: 0, minClients: 0, minEarnings: 0, minRating: 0, minResponseRate: 0, minSuccessScore: 0, requiresApproval: false },
  { id: "level1", label: "Level 1", minOrders: 5, minClients: 3, minEarnings: 400, minRating: 4.4, minResponseRate: 80, minSuccessScore: 0, requiresApproval: false },
  { id: "level2", label: "Level 2", minOrders: 20, minClients: 10, minEarnings: 2000, minRating: 4.6, minResponseRate: 90, minSuccessScore: 0, requiresApproval: false },
  { id: "topRated", label: "Top Rated", minOrders: 40, minClients: 20, minEarnings: 10000, minRating: 4.7, minResponseRate: 90, minSuccessScore: 0, requiresApproval: true },
];

// Fill fields older saved tiers don't have from the default with the same id.
function withDefaults(t) {
  const d = DEFAULT_LEVEL_TIERS.find((x) => x.id === t.id) || {};
  return {
    ...t,
    minResponseRate: t.minResponseRate ?? d.minResponseRate ?? 0,
    minSuccessScore: t.minSuccessScore ?? d.minSuccessScore ?? 0,
    requiresApproval: t.requiresApproval ?? d.requiresApproval ?? false,
  };
}

async function getTiers() {
  try {
    const config = await require("./appConfig.service").getConfig();
    const tiers = Array.isArray(config?.sellerLevels) ? config.sellerLevels.map((t) => (t.toObject ? t.toObject() : t)) : [];
    if (tiers.length > 0) return tiers.map(withDefaults);
  } catch {
    /* fall through */
  }
  return DEFAULT_LEVEL_TIERS;
}

function qualifies(stats, tier) {
  return (
    stats.completedOrders >= tier.minOrders &&
    stats.uniqueClients >= tier.minClients &&
    stats.earnings >= tier.minEarnings &&
    stats.rating >= tier.minRating &&
    stats.responseRate >= (tier.minResponseRate || 0) &&
    (!tier.minSuccessScore || (stats.successScore ?? 0) >= tier.minSuccessScore)
  );
}

// Highest tier the seller meets. Tiers that need approval are skipped
// unless approved; `pending` names the one waiting for an admin.
function pickTier(stats, tiers, approved) {
  let pending = null;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (!qualifies(stats, tiers[i])) continue;
    if (tiers[i].requiresApproval && !approved) {
      pending = pending || tiers[i];
      continue;
    }
    return { tier: tiers[i], pending };
  }
  return { tier: tiers[0], pending };
}

async function statsFor(oid, user) {
  const [agg = {}] = await Payment.aggregate([
    { $match: { freelancerId: oid, status: "delivered", isDeleted: { $ne: true } } },
    { $group: { _id: null, completedOrders: { $sum: 1 }, earnings: { $sum: { $arrayElemAt: ["$items.price", 0] } }, clients: { $addToSet: "$clientId" } } },
    { $project: { completedOrders: 1, earnings: 1, uniqueClients: { $size: "$clients" } } },
  ]);
  const rs = await require("./message.service").responseStats(oid).catch(() => ({}));
  const jobSuccess = await require("./jobSuccess.service").forSeller(oid).catch(() => null);
  return {
    completedOrders: agg.completedOrders || 0,
    earnings: agg.earnings || 0,
    uniqueClients: agg.uniqueClients || 0,
    rating: Number(user.review?.rating || 0),
    totalReviews: Number(user.review?.total || 0),
    // No incoming messages yet counts as 100%: nothing went unanswered.
    responseRate: rs?.rate ?? 100,
    successScore: jobSuccess?.score ?? null,
    jobSuccess,
  };
}

async function computeLevelOverview(userId) {
  if (!userId) throw new Error("userId required");
  const oid = new mongoose.Types.ObjectId(String(userId));
  const user = await User.findById(oid).select("review responseTime fullName username levelOverride topRatedApproval sellerLevel");
  if (!user) throw new Error("User not found");
  const LEVEL_TIERS = await getTiers();
  const stats = await statsFor(oid, user);
  const approved = user.topRatedApproval?.status === "approved";

  const overrideTierId = user.levelOverride?.tierId || "";
  const overrideTier = overrideTierId ? LEVEL_TIERS.find((t) => t.id === overrideTierId) : null;
  const picked = pickTier(stats, LEVEL_TIERS, approved);
  const current = overrideTier || picked.tier;
  const isOverride = !!overrideTier;
  const currentIdx = LEVEL_TIERS.findIndex((t) => t.id === current.id);
  const atTop = currentIdx === LEVEL_TIERS.length - 1;
  const next = LEVEL_TIERS[Math.min(currentIdx + 1, LEVEL_TIERS.length - 1)];
  const { jobSuccess, ...rawStats } = stats;

  return {
    jobSuccess,
    user: { name: user.fullName || user.username || "Seller", username: user.username || null },
    currentLevel: current,
    nextLevel: atTop || isOverride ? null : next,
    pendingApproval: !isOverride && picked.pending ? { tierId: picked.pending.id, label: picked.pending.label, status: user.topRatedApproval?.status || "pending" } : null,
    metrics: {
      successScore: stats.successScore,
      rating: stats.rating || null,
      totalReviews: stats.totalReviews,
      responseRate: stats.responseRate,
    },
    progress:
      atTop || isOverride
        ? null
        : {
            orders: { value: stats.completedOrders, target: next.minOrders },
            uniqueClients: { value: stats.uniqueClients, target: next.minClients },
            earnings: { value: stats.earnings, target: next.minEarnings },
            rating: { value: stats.rating, target: next.minRating },
            responseRate: { value: stats.responseRate, target: next.minResponseRate || 0 },
            ...(next.minSuccessScore ? { successScore: { value: stats.successScore ?? 0, target: next.minSuccessScore } } : {}),
            ...(next.requiresApproval ? { approval: { value: approved ? 1 : 0, target: 1 } } : {}),
          },
    override: isOverride ? { reason: user.levelOverride?.reason || "", setAt: user.levelOverride?.setAt || null } : null,
    computedTierId: picked.tier.id,
    rawStats,
  };
}

const PUBLIC_ID = (id) => (id === "level0" ? "new" : id);

/** Recompute and store user.sellerLevel; marks Top Rated as pending review when earned. */
async function evaluate(userId) {
  const o = await computeLevelOverview(userId);
  const set = { sellerLevel: { id: PUBLIC_ID(o.currentLevel.id), label: o.currentLevel.label, evaluatedAt: new Date() } };
  const prev = await User.findById(userId).select("topRatedApproval sellerLevel").lean();
  if (o.pendingApproval && !["pending", "approved", "declined"].includes(prev?.topRatedApproval?.status)) {
    set.topRatedApproval = { status: "pending", at: new Date(), by: null };
  }
  await User.updateOne({ _id: userId }, { $set: set });
  if (prev?.sellerLevel?.id && prev.sellerLevel.id !== set.sellerLevel.id) {
    try {
      await require("./notification.service").addCustomNotification("freelancer-notification", userId, {
        receiverId: userId, message: `Your seller level is now ${o.currentLevel.label}.`, role: "freelancer", type: "level", viewStatus: false,
      });
    } catch { /* best effort */ }
  }
  return { ...o, stored: set.sellerLevel };
}

/** Housekeeping: re-evaluate sellers not checked in the last hour. */
async function evaluateAll({ maxAgeMs = 3600e3, limit = 200 } = {}) {
  const stale = new Date(Date.now() - maxAgeMs);
  const sellers = await User.find({ role: "freelancer", isDeleted: { $ne: true }, $or: [{ "sellerLevel.evaluatedAt": null }, { "sellerLevel.evaluatedAt": { $lt: stale } }] }, { _id: 1 }).limit(limit).lean();
  let n = 0;
  for (const s of sellers) {
    try {
      await evaluate(s._id);
      n++;
    } catch { /* skip */ }
  }
  return n;
}

/** Admin: approve or decline a seller's Top Rated promotion. */
async function reviewTopRated(sellerId, action, adminId) {
  if (!["approve", "decline", "reset"].includes(action)) throw new Error("action must be approve, decline or reset");
  const status = action === "approve" ? "approved" : action === "decline" ? "declined" : "none";
  const r = await User.updateOne({ _id: sellerId, role: "freelancer" }, { $set: { topRatedApproval: { status, at: new Date(), by: adminId || null } } });
  if (!r.matchedCount) throw new Error("Seller not found");
  return evaluate(sellerId);
}

// Admin list — every seller with their computed level and stats.
async function listAllSellerLevels({ search = "" } = {}) {
  const filter = { role: "freelancer", isDeleted: { $ne: true } };
  if (search.trim()) {
    const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ fullName: re }, { username: re }, { email: re }];
  }
  const sellers = await User.find(filter).select("fullName username email image review levelOverride topRatedApproval").limit(500).lean();
  const LEVEL_TIERS = await getTiers();
  const out = [];
  for (const s of sellers) {
    const stats = await statsFor(s._id, s);
    const approved = s.topRatedApproval?.status === "approved";
    const picked = pickTier(stats, LEVEL_TIERS, approved);
    const overrideTierId = s.levelOverride?.tierId || "";
    const effective = (overrideTierId && LEVEL_TIERS.find((t) => t.id === overrideTierId)) || picked.tier;
    const { jobSuccess, ...rest } = stats;
    out.push({
      _id: s._id,
      id: s._id,
      fullName: s.fullName,
      username: s.username,
      email: s.email,
      image: s.image,
      rating: stats.rating,
      reviews: Number(s.review?.total || 0),
      computedTierId: picked.tier.id,
      computedTierLabel: picked.tier.label,
      effectiveTierId: effective.id,
      effectiveTierLabel: effective.label,
      overrideTierId,
      overrideReason: s.levelOverride?.reason || "",
      topRated: { eligible: !!picked.pending || approved, status: s.topRatedApproval?.status || "none" },
      stats: rest,
    });
  }
  return out;
}

async function setLevelOverride(sellerId, { tierId = "", reason = "", adminId }) {
  const LEVEL_TIERS = await getTiers();
  if (tierId && !LEVEL_TIERS.find((t) => t.id === tierId)) {
    throw new Error(`Unknown tier '${tierId}'`);
  }
  const user = await User.findById(sellerId);
  if (!user) throw new Error("Seller not found");
  if (user.role !== "freelancer") {
    throw new Error("Only freelancers have levels");
  }
  user.levelOverride = {
    tierId,
    reason: String(reason || "").slice(0, 500),
    setBy: adminId || null,
    setAt: new Date(),
  };
  await user.save();
  await evaluate(sellerId).catch(() => {});
  return user;
}

async function updateTiers(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new Error("tiers must be a non-empty array");
  }
  const appConfigService = require("./appConfig.service");
  const cleaned = tiers.map((t) => ({
    id: String(t.id || "").slice(0, 32),
    label: String(t.label || "").slice(0, 80),
    minOrders: Number(t.minOrders) || 0,
    minClients: Number(t.minClients) || 0,
    minEarnings: Number(t.minEarnings) || 0,
    minRating: Number(t.minRating) || 0,
    minResponseRate: Math.min(100, Math.max(0, Number(t.minResponseRate) || 0)),
    minSuccessScore: Math.min(100, Math.max(0, Number(t.minSuccessScore) || 0)),
    requiresApproval: t.requiresApproval === true || t.requiresApproval === "true",
  }));
  for (const t of cleaned) {
    if (!t.id || !t.label) {
      throw new Error("Each tier needs id and label");
    }
  }
  await appConfigService.updateConfig({ sellerLevels: cleaned });
  return cleaned;
}

async function getCurrentTiers() {
  return await getTiers();
}

// Per-gig stats over the last 30 days. Returns gigs grouped by status
// + counts per tab so the UI can render the tabs without a second
// round-trip.
async function listMyGigsWithStats(userId) {
  if (!userId) throw new Error("userId required");
  const oid = new mongoose.Types.ObjectId(String(userId));
  const since30d = new Date(Date.now() - 30 * 86400000);

  const gigs = await Gig.find({ userId: oid, isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .lean();

  // One pass over Payment for all of this seller's orders in the last
  // 30 days — slot into per-gig buckets afterward.
  const paymentRows = await Payment.aggregate([
    {
      $match: {
        freelancerId: oid,
        isDeleted: { $ne: true },
        createdAt: { $gte: since30d },
      },
    },
    {
      $group: {
        _id: { gigId: "$gigId", status: "$status" },
        count: { $sum: 1 },
      },
    },
  ]);

  // Map: gigId -> { orders, cancellations }
  const ordersByGig = new Map();
  for (const row of paymentRows) {
    const key = String(row._id.gigId || "");
    const entry = ordersByGig.get(key) || { orders: 0, cancellations: 0 };
    if (row._id.status === "cancelled") entry.cancellations += row.count;
    else entry.orders += row.count;
    ordersByGig.set(key, entry);
  }

  const STATUSES = [
    "active",
    "pending",
    "requires-modification",
    "draft",
    "denied",
    "paused",
  ];
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));

  const decorated = gigs.map((g) => {
    const status = g.gigStatus || "active";
    if (counts[status] != null) counts[status] += 1;
    const orderRow = ordersByGig.get(String(g._id)) || {};
    return {
      _id: g._id,
      id: g._id,
      title: g.title,
      slug: g.slug,
      images: g.images,
      price: g.price,
      status,
      moderation: g.moderation || {},
      subscription: g.subscription || { enabled: false, discountPercent: 0 },
      createdAt: g.createdAt,
      stats: {
        impressions: g.stats?.impressions || 0,
        clicks: g.stats?.clicks || 0,
        orders: orderRow.orders || 0,
        cancellations: orderRow.cancellations || 0,
        cancellationRate:
          (orderRow.orders || 0) + (orderRow.cancellations || 0) > 0
            ? Math.round(
                ((orderRow.cancellations || 0) /
                  ((orderRow.orders || 0) + (orderRow.cancellations || 0))) *
                  100
              )
            : 0,
      },
    };
  });

  return { gigs: decorated, counts, totalResults: decorated.length };
}

module.exports = {
  computeLevelOverview,
  listMyGigsWithStats,
  listAllSellerLevels,
  setLevelOverride,
  updateTiers,
  evaluate,
  evaluateAll,
  reviewTopRated,
  getCurrentTiers,
  DEFAULT_LEVEL_TIERS,
};
