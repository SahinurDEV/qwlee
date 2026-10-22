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
