// Seller level + gig stats — Fiverr-style.
//
// Two responsibilities:
//   1. computeLevelOverview(userId) — derives current level (0/1/2/Top
//      Rated), success score, rating, response rate, and the progress
//      toward the next level (orders / unique clients / earnings).
//   2. listMyGigsWithStats(userId) — returns every gig the seller owns,
//      grouped by status, with per-gig impressions / clicks / orders /
//      cancellations over the last 30 days.
//
// Thresholds mirror Fiverr's published tiers, tuned a bit downward for
// our smaller seeded marketplace so the metrics actually move during
// QA. Adjust the LEVEL_TIERS table when you onboard real volume.

const mongoose = require("mongoose");
const { Gig, Payment, User } = require("../models");

// Default tier ladder used when the admin hasn't customised them in
// AppConfig.sellerLevels. The admin can edit these from
// /dashboard/seller-levels to re-calibrate as the marketplace grows.
const DEFAULT_LEVEL_TIERS = [
  {
    id: "level0",
    label: "Level 0 (New seller)",
    minOrders: 0,
    minClients: 0,
    minEarnings: 0,
    minRating: 0,
  },
  {
    id: "level1",
    label: "Level 1",
    minOrders: 5,
    minClients: 3,
    minEarnings: 400,
    minRating: 4.7,
  },
  {
    id: "level2",
    label: "Level 2",
    minOrders: 50,
    minClients: 25,
    minEarnings: 2000,
    minRating: 4.7,
  },
  {
    id: "topRated",
    label: "Top Rated",
    minOrders: 100,
    minClients: 50,
    minEarnings: 20000,
    minRating: 4.8,
  },
];

// Read the live tier ladder from AppConfig; fall back to defaults if
// the admin hasn't saved any (or if the config service is unavailable).
async function getTiers() {
  try {
    const appConfigService = require("./appConfig.service");
    const config = await appConfigService.getConfig();
    const tiers = Array.isArray(config?.sellerLevels) ? config.sellerLevels.map((t) => t.toObject ? t.toObject() : t) : [];
    if (tiers.length > 0) return tiers;
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
    stats.rating >= tier.minRating
  );
}

async function computeLevelOverview(userId) {
  if (!userId) throw new Error("userId required");
  const oid = new mongoose.Types.ObjectId(String(userId));

  const user = await User.findById(oid).select(
    "review responseTime fullName username levelOverride"
  );
  if (!user) throw new Error("User not found");

  const LEVEL_TIERS = await getTiers();

  // Aggregate completed orders + earnings + unique clients in one pass.
  // "Completed" in this codebase = status === "delivered" (buyer
  // accepted; freelancer balance has been credited).
  const [agg = {}] = await Payment.aggregate([
    {
      $match: {
        freelancerId: oid,
        status: "delivered",
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        completedOrders: { $sum: 1 },
        earnings: { $sum: { $arrayElemAt: ["$items.price", 0] } },
        clients: { $addToSet: "$clientId" },
      },
    },
    {
      $project: {
        completedOrders: 1,
        earnings: 1,
        uniqueClients: { $size: "$clients" },
      },
    },
  ]);

  const stats = {
    completedOrders: agg.completedOrders || 0,
    earnings: agg.earnings || 0,
    uniqueClients: agg.uniqueClients || 0,
    rating: Number(user.review?.rating || 0),
    totalReviews: Number(user.review?.total || 0),
  };

  // Admin override wins. If the admin has pinned a tier, we hide the
  // qualifies-for-next progress (it'd be misleading) and surface the
  // override reason for transparency.
  const overrideTierId = user.levelOverride?.tierId || "";
  let current;
  let isOverride = false;
  if (overrideTierId) {
    const overrideTier = LEVEL_TIERS.find((t) => t.id === overrideTierId);
    if (overrideTier) {
      current = overrideTier;
      isOverride = true;
    }
  }
  if (!current) {
    // Walk the tiers from highest to lowest and pick the first one the
    // seller satisfies. Default to the first (lowest) tier.
    current = LEVEL_TIERS[0];
    for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
      if (qualifies(stats, LEVEL_TIERS[i])) {
        current = LEVEL_TIERS[i];
        break;
      }
    }
  }
  const currentIdx = LEVEL_TIERS.findIndex((t) => t.id === current.id);
  const next = LEVEL_TIERS[Math.min(currentIdx + 1, LEVEL_TIERS.length - 1)];
  const atTop = currentIdx === LEVEL_TIERS.length - 1;

  // Response time is stored as a string "0".."N" in user.model. Treat
  // anything <= 24 as a green response rate; flip to a derived 0-100%
  // until we wire real DM-response tracking.
  const responseRate =
    Number(user.responseTime) > 0 && Number(user.responseTime) <= 24
      ? Math.max(0, 100 - Number(user.responseTime) * 2)
      : 100;

  // Success score is a 0–10 composite of rating × 2 (max 10). When
  // there are no reviews we surface a dash on the UI.
  const successScore = stats.totalReviews > 0 ? Number((stats.rating * 2).toFixed(1)) : null;

  return {
    user: {
      name: user.fullName || user.username || "Seller",
      username: user.username || null,
    },
    currentLevel: current,
    nextLevel: atTop || isOverride ? null : next,
    metrics: {
      successScore,
      rating: stats.rating || null,
      totalReviews: stats.totalReviews,
      responseRate,
    },
    progress:
      atTop || isOverride
        ? null
        : {
            orders: { value: stats.completedOrders, target: next.minOrders },
            uniqueClients: { value: stats.uniqueClients, target: next.minClients },
            earnings: { value: stats.earnings, target: next.minEarnings },
            rating: { value: stats.rating, target: next.minRating },
          },
    override: isOverride
      ? {
          reason: user.levelOverride?.reason || "",
          setAt: user.levelOverride?.setAt || null,
        }
      : null,
    rawStats: stats,
  };
}

// Admin list — every seller (role=freelancer) with their computed
// level, key stats, and override info. Used by /dashboard/seller-levels.
async function listAllSellerLevels({ search = "" } = {}) {
  const filter = { role: "freelancer", isDeleted: { $ne: true } };
  if (search.trim()) {
    const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ fullName: re }, { username: re }, { email: re }];
  }
  const sellers = await User.find(filter)
    .select("fullName username email image review levelOverride")
    .limit(500)
    .lean();

  const LEVEL_TIERS = await getTiers();

  // Compute everyone's metrics in one aggregation pass — cheaper than
  // calling computeLevelOverview() N times for large platforms.
  const sellerIds = sellers.map((s) => s._id);
  const aggRows = await Payment.aggregate([
    {
      $match: {
        freelancerId: { $in: sellerIds },
        status: "delivered",
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: "$freelancerId",
        completedOrders: { $sum: 1 },
        earnings: { $sum: { $arrayElemAt: ["$items.price", 0] } },
        clients: { $addToSet: "$clientId" },
      },
    },
  ]);
  const statsBySeller = new Map(
    aggRows.map((r) => [
      String(r._id),
      {
        completedOrders: r.completedOrders || 0,
        earnings: r.earnings || 0,
        uniqueClients: (r.clients || []).length,
      },
    ])
  );

  return sellers.map((s) => {
    const stats = {
      completedOrders: 0,
      earnings: 0,
      uniqueClients: 0,
      rating: Number(s.review?.rating || 0),
      ...(statsBySeller.get(String(s._id)) || {}),
    };
    const overrideTierId = s.levelOverride?.tierId || "";
    let computed = LEVEL_TIERS[0];
    for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
      if (qualifies(stats, LEVEL_TIERS[i])) {
        computed = LEVEL_TIERS[i];
        break;
      }
    }
    const effective = overrideTierId
      ? LEVEL_TIERS.find((t) => t.id === overrideTierId) || computed
      : computed;
    return {
      _id: s._id,
      id: s._id,
      fullName: s.fullName,
      username: s.username,
      email: s.email,
      image: s.image,
      rating: stats.rating,
      reviews: Number(s.review?.total || 0),
      computedTierId: computed.id,
      computedTierLabel: computed.label,
      effectiveTierId: effective.id,
      effectiveTierLabel: effective.label,
      overrideTierId,
      overrideReason: s.levelOverride?.reason || "",
      stats,
    };
  });
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
  getCurrentTiers,
  DEFAULT_LEVEL_TIERS,
};
