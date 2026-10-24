const express = require("express");
const auth = require("../../middlewares/auth");
const router = express.Router();
const reviewController = require("../../controllers/reviews.controller");

router
  .route("/")
  .post(auth("common"), reviewController.createReview)
  .get(reviewController.getReviews); // public, like gig pages

router.get("/summary", require("../../utils/catchAsync")(async (req, res) => {
  const data = await require("../../services/reviews.service").getSummary(req.query);
  res.json({ code: 200, message: "Review summary", data: { attributes: data } });
}));

// Seller -> buyer reviews (double-blind).
{
  const svc = require("../../services/buyerReviews.service");
  const catchAsync = require("../../utils/catchAsync");
  const ok = (res, data, message = "OK") => res.json({ code: 200, message, data: { attributes: data } });
  router.post("/buyer", auth("common"), catchAsync(async (req, res) => ok(res, await svc.create(req.body?.orderId, req.user.id, req.body || {}), "Review saved")));
  router.get("/buyer/order/:orderId", auth("common"), catchAsync(async (req, res) => ok(res, { review: await svc.forOrder(req.params.orderId, req.user.id) })));
  router.get("/buyer/:buyerId", catchAsync(async (req, res) => ok(res, await svc.listForBuyer(req.params.buyerId, req.query.limit))));
}

// Buyer asks "did I already review this order?" — used by the order
// detail page to switch between Leave / Edit / show-your-review.
router.get(
  "/by-order/:orderId",
  auth("common"),
  reviewController.getReviewByOrder
);

// Seller replies once per review.
router.patch(
  "/:reviewId/reply",
  auth("common"),
  reviewController.replyReview
);

module.exports = router;
