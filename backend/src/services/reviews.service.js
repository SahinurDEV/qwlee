const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { Reviews, Orders, User, Gig } = require("../models");
const emailService = require("./email.service");

// Create a review tied to a delivered order. Enforces:
//   - the order exists and belongs to the buyer
//   - the order is in a state that allows reviewing (delivered / completed)
//   - one review per order (per buyer)
//
// freelancerId + gigId are taken from the order so the buyer can't
// misattribute their review to a different seller/gig by tampering
// with the request body.
const createReview = async (payload, userId) => {
  const { orderId, rating, review } = payload || {};
  const subRatings = {};
  for (const k of ["communication", "service", "recommend"]) {
    const v = payload?.subRatings?.[k];
    if (v === undefined || v === null || v === "") continue;
    if (!Number.isInteger(Number(v)) || v < 1 || v > 5) throw new ApiError(httpStatus.BAD_REQUEST, `${k} rating must be 1-5`);
    subRatings[k] = Number(v);
  }
  let privateRating;
  if (payload?.privateRating !== undefined && payload?.privateRating !== null && payload?.privateRating !== "") {
    privateRating = Number(payload.privateRating);
    if (!Number.isInteger(privateRating) || privateRating < 1 || privateRating > 5) throw new ApiError(httpStatus.BAD_REQUEST, "privateRating must be 1-5");
  }
  if (!orderId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "orderId is required");
  }
  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(httpStatus.BAD_REQUEST, "rating must be between 1 and 5");
  }
  if (!review || !String(review).trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "review text is required");
  }

  // Orders placed through checkout live in Payment; Orders holds legacy rows.
  const order = (await require("../models").Payment.findById(orderId).catch(() => null)) || (await Orders.findById(orderId).catch(() => null));
  if (!order) throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
  if (String(order.clientId) !== String(userId)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only the buyer can review this order");
  }
  if (!["delivered", "completed"].includes(order.status)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You can only review an order once it's delivered"
    );
  }

  const windowDays = (await require("./siteSettings.service").get()).marketplace.reviewWindowDays;
  const doneAt = order.completedAt || order.updatedAt;
  if (windowDays && doneAt && Date.now() > new Date(doneAt).getTime() + windowDays * 86400000) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Reviews can be left up to ${windowDays} days after an order is completed.`);
  }

  const existing = await Reviews.findOne({ orderId, userId });
  if (existing) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You already reviewed this order");
  }

  const newReview = await Reviews.create({
    userId,
    freelancerId: order.freelancerId,
    gigId: order.gigId,
    orderId,
    rating: Number(rating),
    review: String(review).trim(),
    ...(Object.keys(subRatings).length ? { subRatings } : {}),
    ...(privateRating ? { privateRating } : {}),
    privateNote: String(payload?.privateNote || "").trim().slice(0, 1000),
  });

  require("./gigStats.service").recomputeLater(order.gigId);
  // Double-blind: the seller's review of the buyer goes public now too.
  require("./buyerReviews.service").publishDue().catch(() => {});

  // Email the seller that they got a review.
  try {
    const [buyer, seller, gig] = await Promise.all([
      User.findById(userId).select("fullName email username"),
      User.findById(order.freelancerId).select("fullName email username"),
      order.gigId ? Gig.findById(order.gigId).select("title") : null,
    ]);
    if (seller?.email) {
      emailService.sendReviewReceivedSeller(seller.email, {
        sellerName: seller.fullName || seller.username,
        buyerName: buyer?.fullName || buyer?.username,
        gigTitle: gig?.title || "your gig",
        rating: Number(rating),
        review: String(review).trim(),
      });
    }
  } catch (e) {
    /* swallow */
  }

  return newReview;
};

const { PUBLIC_USER_SELECT, toPublicUser } = require("../utils/publicUser");
// Reviews are public; populated people only carry public profile fields.
const publicReview = (r) => {
  const o = typeof r?.toObject === "function" ? r.toObject() : { ...r };
  o.id = String(o._id || o.id);
  delete o.privateRating;
  delete o.privateNote;
  if (o.userId && typeof o.userId === "object") o.userId = toPublicUser(o.userId);
  if (o.freelancerId && typeof o.freelancerId === "object") o.freelancerId = toPublicUser(o.freelancerId);
  return o;
};
const POPULATE = [
  { path: "gigId", select: "title slug images price" },
  { path: "userId", select: PUBLIC_USER_SELECT },
  { path: "freelancerId", select: PUBLIC_USER_SELECT },
];

const getReviews = async (filter, options, userId) => {
  if (userId) {
    filter.userId = userId;
  }
  options.populate = POPULATE;
  const reviews = await Reviews.paginate(filter, options);
  reviews.results = reviews.results.map(publicReview);
  return reviews;
};

/** Average, star histogram and sub-rating averages for a gig or seller. */
const getSummary = async ({ gigId, freelancerId }) => {
  const mongoose = require("mongoose");
  const match = {};
  if (gigId && mongoose.isValidObjectId(gigId)) match.gigId = new mongoose.Types.ObjectId(gigId);
  else if (freelancerId && mongoose.isValidObjectId(freelancerId)) match.freelancerId = new mongoose.Types.ObjectId(freelancerId);
  else throw new ApiError(httpStatus.BAD_REQUEST, "gigId or freelancerId is required");
  const [agg] = await Reviews.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        average: { $avg: "$rating" },
        communication: { $avg: "$subRatings.communication" },
        service: { $avg: "$subRatings.service" },
        recommend: { $avg: "$subRatings.recommend" },
        stars: { $push: { $round: ["$rating", 0] } },
      },
    },
  ]);
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
  const histogram = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  (agg?.stars || []).forEach((n) => { if (histogram[n] !== undefined) histogram[n]++; });
  return {
    count: agg?.count || 0,
    average: r1(agg?.average),
    histogram,
    breakdown: { communication: r1(agg?.communication), service: r1(agg?.service), recommend: r1(agg?.recommend) },
  };
};

// Buyer-side lookup: was this order already reviewed? Returns the
// review doc or null so the order detail page can render the right
// CTA (Leave / Edit / show their existing review).
const getReviewByOrder = async (orderId, userId) => {
  if (!orderId) return null;
  const r = await Reviews.findOne({ orderId, userId }).populate(POPULATE);
  return r ? publicReview(r) : null;
};

// Seller's one-shot reply to a review. Only the freelancer the review
// is for can reply, and only once — subsequent calls are blocked so
// sellers can't rewrite history mid-dispute.
const replyToReview = async (reviewId, freelancerId, message) => {
  const text = String(message || "").trim();
  if (!text) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Reply message is required");
  }
  if (text.length > 1500) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Reply is too long (max 1500 chars)");
  }

  const review = await Reviews.findById(reviewId);
  if (!review) throw new ApiError(httpStatus.NOT_FOUND, "Review not found");
  if (String(review.freelancerId) !== String(freelancerId)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only the seller of this gig can reply"
    );
  }
  if (review.sellerReply && review.sellerReply.message) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "You have already replied to this review"
    );
  }

  review.sellerReply = { message: text, repliedAt: new Date() };
  await review.save();

  // Email the buyer that the seller replied.
  try {
    const [buyer, seller, gig] = await Promise.all([
      User.findById(review.userId).select("fullName email username"),
      User.findById(review.freelancerId).select("fullName email username"),
      review.gigId ? Gig.findById(review.gigId).select("title") : null,
    ]);
    if (buyer?.email) {
      emailService.sendReviewReplyBuyer(buyer.email, {
        buyerName: buyer.fullName || buyer.username,
        sellerName: seller?.fullName || seller?.username,
        gigTitle: gig?.title || "your gig",
        reply: text,
      });
    }
  } catch (e) {
    /* swallow */
  }

  return review;
};

module.exports = {
  getSummary,
  createReview,
  getReviews,
  getReviewByOrder,
  replyToReview,
};
