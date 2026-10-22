const { Reviews, User } = require("../src/models");
const { pick, rand, chance } = require("./utils/random");

const REVIEW_TEMPLATES = {
  5: [
    "Genuinely impressed. Delivered ahead of schedule and the code was cleaner than I expected. Would work with again.",
    "Top-tier work. Communication was crisp; every PR had a clear changelog. Hire without hesitation.",
    "Saved our launch. Came in mid-sprint, picked up our messy codebase, and shipped a working feature in days.",
    "Best freelancer I've worked with on this platform. Took ownership of edge cases I hadn't even thought about.",
    "Fast, thoughtful, and the deliverable matched the scope exactly. No surprises. Booking again.",
  ],
  4: [
    "Solid work overall. One revision needed on the mobile layout but turnaround was quick.",
    "Quality was high. Timeline slipped by a day but communication kept it from being a problem.",
    "Good experience. Would have liked a kickoff call but the final result was exactly what we briefed.",
    "Delivered as promised. A few minor polish items, all fixed in revision. Recommended.",
  ],
  3: [
    "Met spec but didn't go beyond it. If you have a tightly-scoped brief, fine. Don't expect creative input.",
    "Decent work, slow communication. Took two days to respond to revision feedback.",
  ],
};

async function seedReviews({ orders, buyers, sellers }) {
  // Reviews only attach to delivered orders.
  const deliveredOrders = orders.filter((o) => o.status === "delivered");
  const docs = [];
  const sellerRatings = new Map(); // sellerId → { sum, count }

  for (const [n, order] of deliveredOrders.entries()) {
    // The first three are always reviewed so every seed has rated gigs.
    if (n >= 3 && !chance(0.85)) continue; // ~15% of completed orders go unreviewed
    const rating = chance(0.7) ? 5 : chance(0.7) ? 4 : 3;
    const review = pick(REVIEW_TEMPLATES[rating]);

    docs.push({
      userId: order.clientId,
      freelancerId: order.freelancerId,
      gigId: order.gigId,
      review,
      rating,
      // Deterministic breakdown (no extra random draws).
      subRatings: { communication: rating, service: Math.max(1, rating - (String(order._id).charCodeAt(23) % 2)), recommend: rating },
      createdAt: order.deliveryDate,
      updatedAt: order.deliveryDate,
    });

    const key = order.freelancerId.toString();
    const cur = sellerRatings.get(key) || { sum: 0, count: 0 };
    cur.sum += rating;
    cur.count += 1;
    sellerRatings.set(key, cur);
  }

  const reviews = await Reviews.insertMany(docs);

  // Roll up to user.review.{rating,total}
  await Promise.all(
    [...sellerRatings.entries()].map(([sellerId, { sum, count }]) =>
      User.updateOne(
        { _id: sellerId },
        {
          $set: {
            "review.rating": Number((sum / count).toFixed(2)),
            "review.total": count,
          },
        }
      )
    )
  );

  return { reviews };
}

module.exports = { seedReviews };
