// Promoted gigs: a seller pays a daily price from their balance and the gig
// is shown as "Sponsored" above matching search results. Unused days are
// refunded pro rata when a promotion is cancelled.
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const { Gig, User, Promotion } = require("../models");

const DAY = 86400000;
const MAX_DAYS = 30;
const SLOTS = 2;
const dayPrice = () => {
  const n = Number(process.env.PROMO_DAY_PRICE);
  return Number.isFinite(n) && n > 0 ? n : 5;
};
const config = () => ({ dayPrice: dayPrice(), maxDays: MAX_DAYS, slots: SLOTS });
const money = (n) => Math.round(n * 100) / 100;

function validId(id, what = "gig") {
  if (!mongoose.isValidObjectId(String(id || ""))) throw new ApiError(httpStatus.BAD_REQUEST, `Invalid ${what} id`);
  return new mongoose.Types.ObjectId(String(id));
}

async function create(userId, { gigId, days }) {
  const id = validId(gigId);
  const d = Number(days);
  if (!Number.isInteger(d) || d < 1 || d > MAX_DAYS) throw new ApiError(httpStatus.BAD_REQUEST, `Days must be a whole number from 1 to ${MAX_DAYS}`);
  const gig = await Gig.findOne({ _id: id, isDeleted: { $ne: true } }).lean();
  if (!gig || String(gig.userId) !== String(userId)) throw new ApiError(httpStatus.NOT_FOUND, "Gig not found");
  if (gig.gigStatus !== "active") throw new ApiError(httpStatus.BAD_REQUEST, "Only active gigs can be promoted");
  {
    const ORDER = ["new", "level1", "level2", "topRated"];
    const min = (await require("./siteSettings.service").get()).marketplace.adsMinLevel || "new";
    const u = await require("../models").User.findById(userId).select("sellerLevel").lean();
    const have = ORDER.indexOf(u?.sellerLevel?.id || "new");
    if (have < ORDER.indexOf(min)) throw new ApiError(httpStatus.FORBIDDEN, `Promoted gigs are available from ${{ level1: "Level 1", level2: "Level 2", topRated: "Top Rated" }[min] || min} up.`);
  }
  const cost = money(d * dayPrice());
  // Atomic debit: parallel requests cannot overdraw the balance.
  const debited = await User.findOneAndUpdate({ _id: userId, balance: { $gte: cost } }, { $inc: { balance: -cost } });
  if (!debited) throw new ApiError(httpStatus.BAD_REQUEST, `Insufficient balance: promotion costs $${cost}`);
  const now = new Date();
  // Buying again extends the running promotion.
  const startsAt = gig.promotedUntil && gig.promotedUntil > now ? new Date(gig.promotedUntil) : now;
  const endsAt = new Date(startsAt.getTime() + d * DAY);
  const promo = await Promotion.create({ gigId: id, userId, days: d, cost, startsAt, endsAt });
  await Gig.updateOne({ _id: id }, { $set: { promotedUntil: endsAt } });
  return { promotion: promo.toJSON(), balance: money(debited.balance - cost) };
}

async function cancel(userId, promoId) {
  const id = validId(promoId, "promotion");
  const now = new Date();
  const promo = await Promotion.findOneAndUpdate(
    { _id: id, userId, status: "active", endsAt: { $gt: now } },
    { $set: { status: "cancelled" } },
    { new: false }
  );
  if (!promo) throw new ApiError(httpStatus.NOT_FOUND, "No running promotion with that id");
  const unusedMs = promo.endsAt - Math.max(now, promo.startsAt);
  const refund = money(Math.floor(unusedMs / DAY) * (promo.cost / promo.days));
  if (refund > 0) await User.updateOne({ _id: userId }, { $inc: { balance: refund } });
  // Promotions queued after this one move up so there is no unpaid gap.
  const later = await Promotion.find({ gigId: promo.gigId, status: "active", startsAt: { $gte: promo.endsAt } });
  for (const p of later) {
    await Promotion.updateOne({ _id: p._id }, { $set: { startsAt: new Date(p.startsAt - unusedMs), endsAt: new Date(p.endsAt - unusedMs) } });
  }
  // Recompute the gig's end from whatever promotions are still running.
  const rest = await Promotion.find({ gigId: promo.gigId, status: "active", endsAt: { $gt: now } }).sort({ endsAt: -1 }).limit(1).lean();
  await Gig.updateOne({ _id: promo.gigId }, { $set: { promotedUntil: rest[0]?.endsAt || null } });
  return { refund };
}

async function list(userId) {
  const results = await Promotion.find({ userId }).sort({ createdAt: -1 }).limit(100).populate("gigId", "title slug").lean();
  const now = Date.now();
  return results.map((p) => ({
    id: String(p._id),
    gig: p.gigId ? { id: String(p.gigId._id), title: p.gigId.title, slug: p.gigId.slug } : null,
    days: p.days,
    cost: p.cost,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    impressions: p.impressions,
    clicks: p.clicks,
    status: p.status === "active" ? (p.endsAt <= now ? "ended" : p.startsAt > now ? "scheduled" : "running") : p.status,
  }));
}

// Credit the promotion that is running now for these gigs.
async function track(gigIds, field) {
  const now = new Date();
  const ids = gigIds.filter((g) => mongoose.isValidObjectId(String(g))).map((g) => new mongoose.Types.ObjectId(String(g)));
  if (!ids.length) return;
  for (const gigId of ids) {
    await Promotion.updateOne(
      { gigId, status: "active", startsAt: { $lte: now }, endsAt: { $gt: now } },
      { $inc: { [field]: 1 } }
    );
  }
}

module.exports = { config, create, cancel, list, track, SLOTS };
