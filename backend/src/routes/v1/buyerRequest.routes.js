const express = require("express");
const auth = require("../../middlewares/auth");
const optionalAuth = require("../../middlewares/optionalAuth");
const c = require("../../controllers/buyerRequest.controller");

const router = express.Router();

// Admin feature toggle: when buyer requests are off, nothing new can be
// posted (existing data stays readable).
const siteSettings = require("../../services/siteSettings.service");
router.use((req, res, next) => {
  if (req.method === "GET") return next();
  siteSettings.assertFeature("buyerRequests", "Buyer requests").then(() => next(), next);
});

router.route("/").get(optionalAuth(), c.listOpen).post(auth("withOutAdmin"), c.createRequest);
router.get("/mine", auth("withOutAdmin"), c.listMine);
router.get("/offers/mine", auth("withOutAdmin"), c.listMyOffers);
router.post("/offers/:offerId/withdraw", auth("withOutAdmin"), c.withdrawOffer);
router.post("/offers/:offerId/decline", auth("withOutAdmin"), c.declineOffer);
router.route("/:requestId").get(optionalAuth(), c.getRequest).patch(auth("withOutAdmin"), c.updateRequest);
router.post("/:requestId/offers", auth("withOutAdmin"), c.createOffer);

module.exports = router;
