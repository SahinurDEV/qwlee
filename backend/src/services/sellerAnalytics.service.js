// Seller analytics: earnings over time, order funnel per gig, delivery
// and cancellation rates, repeat buyers. All from live collections.
const mongoose = require("mongoose");
const { Payment, Gig, Reviews } = require("../models");

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

async function forSeller(sellerId, days = 30) {
  const sid = new mongoose.Types.ObjectId(String(sellerId));
  const since = new Date(Date.now() - days * 86400e3);
  const prevSince = new Date(Date.now() - 2 * days * 86400e3);
  const bucket = days > 120 ? "%Y-%m" : days > 45 ? "%G-W%V" : "%Y-%m-%d";

  const [orders, prevOrders, series, gigs, gigOrders, ratings, buyers] = await Promise.all([
    Payment.find({ freelancerId: sid, createdAt: { $gte: since } }, { status: 1, price: 1, sellerEarning: 1, deliveryDate: 1, "delivery.lastDeliveredAt": 1, completedAt: 1, tips: 1, clientId: 1 }).lean(),
    Payment.find({ freelancerId: sid, $or: [{ createdAt: { $gte: prevSince, $lt: since } }, { completedAt: { $gte: prevSince, $lt: since } }] }, { status: 1, sellerEarning: 1, createdAt: 1, completedAt: 1 }).lean(),
    Payment.aggregate([
      { $match: { freelancerId: sid, status: "delivered", completedAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: bucket, date: "$completedAt" } }, earnings: { $sum: { $ifNull: ["$sellerEarning", 0] } }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Gig.find({ userId: sid, isDeleted: { $ne: true } }, { title: 1, slug: 1, stats: 1, gigStatus: 1 }).lean(),
    Payment.aggregate([
      { $match: { freelancerId: sid, createdAt: { $gte: since } } },
      { $group: { _id: "$gigId", orders: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, { $ifNull: ["$sellerEarning", 0] }, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } } } },
    ]),
    Reviews.aggregate([{ $match: { freelancerId: sid } }, { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { freelancerId: sid, status: "delivered" } }, { $group: { _id: "$clientId", n: { $sum: 1 } } }]),
  ]);

  // Earnings count when an order completes (same basis as the series).
  const earnedPrev = prevOrders.filter((o) => o.status === "delivered" && o.completedAt && new Date(o.completedAt) >= prevSince && new Date(o.completedAt) < since)
    .reduce((n, o) => n + (o.sellerEarning || 0), 0);
  const ordersPrev = prevOrders.filter((o) => new Date(o.createdAt) >= prevSince && new Date(o.createdAt) < since).length;
  const tips = orders.reduce((n, o) => n + (o.tips || []).reduce((m, t) => m + (t.refund?.status === "succeeded" ? 0 : t.net || 0), 0), 0);
  const delivered = orders.filter((o) => o.delivery?.lastDeliveredAt && o.deliveryDate);
  const onTime = delivered.filter((o) => new Date(o.delivery.lastDeliveredAt) <= new Date(o.deliveryDate)).length;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;
  const byGig = Object.fromEntries(gigOrders.map((g) => [String(g._id), g]));

  return {
    range: days,
    totals: {
      earnings: round2(series.reduce((n, x) => n + x.earnings, 0)),
      earningsPrev: round2(earnedPrev),
      tips: round2(tips),
      orders: orders.length,
      ordersPrev,
      active: orders.filter((o) => ["active", "late"].includes(o.status)).length,
      completed: orders.filter((o) => o.status === "delivered").length,
      cancelled,
      cancellationRate: pct(cancelled, orders.length),
      onTimeRate: delivered.length ? pct(onTime, delivered.length) : null,
      avgOrderValue: orders.length ? round2(orders.reduce((n, o) => n + (o.price || 0), 0) / orders.length) : 0,
      rating: ratings[0] ? Math.round(ratings[0].avg * 10) / 10 : null,
      reviews: ratings[0]?.count || 0,
      repeatBuyerRate: pct(buyers.filter((b) => b.n > 1).length, buyers.length),
    },
    series: series.map((s) => ({ period: s._id, earnings: round2(s.earnings), orders: s.orders })),
    // Impressions/clicks are lifetime counters (no per-day history).
    gigs: gigs
      .map((g) => {
        const o = byGig[String(g._id)] || {};
        const impressions = g.stats?.impressions || 0;
        const clicks = g.stats?.clicks || 0;
        return {
          id: String(g._id), title: g.title, slug: g.slug, status: g.gigStatus,
          impressions, clicks, ctr: pct(clicks, impressions),
          orders: o.orders || 0, conversion: pct(o.orders || 0, clicks), revenue: round2(o.revenue), cancelled: o.cancelled || 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders),
  };
}

module.exports = { forSeller };
