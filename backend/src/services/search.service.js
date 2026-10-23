const { escapeRegex } = require("../utils/publicUser");
// Search-log service.

const { SearchLog } = require("../models");

// Single track call. `userId` may be null (anonymous visitor) — that's
// fine, we keep the row and still get country/IP for the admin view.
async function track({ query, displayQuery, userId, ip, country, countryCode, city, userAgent, referer, route }) {
  const q = String(query || "").trim();
  if (!q || q.length > 200) return null;
  return SearchLog.create({
    query: q.toLowerCase(),
    displayQuery: (displayQuery || q).slice(0, 200),
    userId: userId || null,
    ip: ip || "",
    country: country || "",
    countryCode: (countryCode || "").toUpperCase().slice(0, 2),
    city: city || "",
    userAgent: (userAgent || "").slice(0, 300),
    referer: (referer || "").slice(0, 500),
    route: (route || "").slice(0, 200),
  });
}

// Top N queries over the last `days` days. Used by the homepage
// "Trending searches" strip.
async function getTrending({ days = 7, limit = 10 } = {}) {
  const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  const rows = await SearchLog.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: "$query",
        count: { $sum: 1 },
        displayQuery: { $first: "$displayQuery" },
        lastAt: { $max: "$createdAt" },
      },
    },
    { $sort: { count: -1, lastAt: -1 } },
    { $limit: Math.max(1, Math.min(50, Number(limit) || 10)) },
  ]);
  return rows.map((r) => ({
    query: r.displayQuery || r._id,
    count: r.count,
    lastAt: r.lastAt,
  }));
}

// Admin list — paginated rows with optional filters.
async function listForAdmin({ search = "", country = "", scope = "all", limit = 50, page = 1 } = {}) {
  const filter = {};
  if (search.trim()) {
    filter.query = { $regex: escapeRegex(search.trim().toLowerCase().slice(0, 100)), $options: "i" };
  }
  if (country) {
    filter.country = country;
  }
  if (scope === "anon") filter.userId = null;
  if (scope === "auth") filter.userId = { $ne: null };

  const items = await SearchLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(Math.max(0, (page - 1) * limit))
    .limit(limit)
    .populate({ path: "userId", select: "fullName username email role image" });
  const total = await SearchLog.countDocuments(filter);
  return { results: items, totalResults: total, page, limit };
}

async function stats() {
  const since1d = new Date(Date.now() - 1 * 86400000);
  const since7d = new Date(Date.now() - 7 * 86400000);
  const [total, last24h, last7d, anon] = await Promise.all([
    SearchLog.countDocuments({}),
    SearchLog.countDocuments({ createdAt: { $gte: since1d } }),
    SearchLog.countDocuments({ createdAt: { $gte: since7d } }),
    SearchLog.countDocuments({ userId: null }),
  ]);
  // Unique queries in the last 7 days.
  const uniques7d = await SearchLog.distinct("query", {
    createdAt: { $gte: since7d },
  });
  // Country roll-up over the same window.
  const byCountry = await SearchLog.aggregate([
    { $match: { createdAt: { $gte: since7d }, country: { $ne: "" } } },
    { $group: { _id: "$country", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
  return {
    total,
    last24h,
    last7d,
    anon,
    auth: total - anon,
    uniqueQueries7d: uniques7d.length,
    byCountry: byCountry.map((r) => ({ country: r._id, count: r.count })),
  };
}

module.exports = { track, getTrending, listForAdmin, stats };
