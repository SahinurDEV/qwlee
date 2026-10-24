const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const pick = require("../utils/pick");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { reviewsService } = require("../services");

const createReview = catchAsync(async (req, res) => {
  const review = await reviewsService.createReview(req.body, req.user.id);
  res.status(httpStatus.CREATED).json(
    response({
      message: "Review Created",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: review,
    })
  );
});

const getReviews = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["name", "status", "userId", "gigId", "freelancerId"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  // Public filters for the gig page: one star value, and a named sort.
  const star = Number(req.query.rating);
  if (Number.isInteger(star) && star >= 1 && star <= 5) {
    filter.rating = { $gte: star - 0.5, $lt: star + 0.5 };
  }
  if (req.query.withReply === "true") filter["sellerReply.message"] = { $nin: ["", null] };
  const SORTS = { newest: "createdAt:desc", oldest: "createdAt:asc", highest: "rating:desc,createdAt:desc", lowest: "rating:asc,createdAt:desc" };
  if (req.query.sort) {
    if (!SORTS[req.query.sort]) throw new ApiError(httpStatus.BAD_REQUEST, "Unknown sort");
    options.sortBy = SORTS[req.query.sort];
  }
  if (options.limit) options.limit = Math.min(Math.max(Number(options.limit) || 10, 1), 50);
  const reviews = await reviewsService.getReviews(filter, options, req.query.userId);
  res.status(httpStatus.OK).json(
    response({
      message: "All Reviews",
      status: "OK",
      statusCode: httpStatus.OK,
      data: reviews,
    })
  );
});

const getReviewByOrder = catchAsync(async (req, res) => {
  const review = await reviewsService.getReviewByOrder(
    req.params.orderId,
    req.user.id
  );
  res.status(httpStatus.OK).json(
    response({
      message: review ? "Review found" : "No review yet",
      status: "OK",
      statusCode: httpStatus.OK,
      data: review,
    })
  );
});

const replyReview = catchAsync(async (req, res) => {
  const review = await reviewsService.replyToReview(
    req.params.reviewId,
    req.user.id,
    req.body?.message
  );
  res.status(httpStatus.OK).json(
    response({
      message: "Reply posted",
      status: "OK",
      statusCode: httpStatus.OK,
      data: review,
    })
  );
});

module.exports = {
  createReview,
  getReviews,
  getReviewByOrder,
  replyReview,
};
