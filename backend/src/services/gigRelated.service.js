// "More from this seller" and "People also viewed" for the gig page.
const mongoose = require("mongoose");
const { Gig } = require("../models");
const { PUBLIC_USER_SELECT } = require("../utils/publicUser");

const LIVE = { gigStatus: "active", isDeleted: { $ne: true } };
const POP = [
  { path: "userId", select: PUBLIC_USER_SELECT },
  { path: "categoriesId", select: "name" },
];

const moreFromSeller = async (gig, limit = 8) =>
  Gig.find({ ...LIVE, userId: gig.userId, _id: { $ne: gig._id } })
    .sort({ ordersCompleted: -1, createdAt: -1 })
    .limit(limit)
    .populate(POP);

// Gigs that signed-in visitors of this gig also opened (page activity in
// the last 90 days), topped up with popular gigs from the same
// subcategory / category so the row is never empty.
const alsoViewed = async (gig, exclude, limit = 8) => {
  const { Activity } = require("../models");
  const esc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keys = [gig.slug, String(gig._id)].filter(Boolean);
  const routeRe = new RegExp(`^/gig/(${keys.map(esc).join("|")})(?:[/?#]|$)`);
  const since = new Date(Date.now() - 90 * 86400000);
  const viewers = await Activity.distinct("userId", { type: "page", route: routeRe, createdAt: { $gte: since } });
  const skip = new Set([String(gig._id), ...exclude.map((g) => String(g._id))]);
  const out = [];
  if (viewers.length) {
    const rows = await Activity.aggregate([
      { $match: { userId: { $in: viewers.slice(0, 500) }, type: "page", route: /^\/gig\/[^/?#]+/, createdAt: { $gte: since } } },
      { $project: { userId: 1, key: { $arrayElemAt: [{ $split: [{ $arrayElemAt: [{ $split: ["$route", "?"] }, 0] }, "/"] }, 2] } } },
      { $group: { _id: "$key", users: { $addToSet: "$userId" } } },
      { $project: { n: { $size: "$users" } } },
      { $sort: { n: -1 } },
      { $limit: 40 },
    ]);
    const wanted = rows.map((r) => r._id).filter((k) => k && !keys.includes(k));
    if (wanted.length) {
      const ids = wanted.filter((k) => mongoose.isValidObjectId(k));
      const found = await Gig.find({ ...LIVE, $or: [{ slug: { $in: wanted } }, { _id: { $in: ids } }] }).populate(POP);
      const rank = new Map(wanted.map((k, i) => [k, i]));
      found
        .sort((a, b) => (rank.get(a.slug) ?? rank.get(String(a._id))) - (rank.get(b.slug) ?? rank.get(String(b._id))))
        .forEach((g) => { if (!skip.has(String(g._id)) && out.length < limit) { out.push(g); skip.add(String(g._id)); } });
    }
  }
  const source = out.length ? "views" : "similar";
  for (const scope of [gig.subCategoryId && { subCategoryId: gig.subCategoryId }, gig.categoriesId && { categoriesId: gig.categoriesId }]) {
    if (!scope || out.length >= limit) continue;
    const more = await Gig.find({ ...LIVE, ...scope, _id: { $nin: [...skip].map((x) => new mongoose.Types.ObjectId(x)) } })
      .sort({ ordersCompleted: -1, "rating.avg": -1 })
      .limit(limit - out.length)
      .populate(POP);
    more.forEach((g) => { out.push(g); skip.add(String(g._id)); });
  }
  return { gigs: out, source };
};

const related = async (gigId) => {
  if (!mongoose.isValidObjectId(gigId)) return null;
  const gig = await Gig.findOne({ _id: gigId, ...LIVE }).select("userId categoriesId subCategoryId slug");
  if (!gig) return null;
  const mine = await moreFromSeller(gig);
  const also = await alsoViewed(gig, mine);
  return { moreFromSeller: mine, alsoViewed: also.gigs, alsoViewedSource: also.source };
};

module.exports = { related };
