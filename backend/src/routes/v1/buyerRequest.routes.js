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
// Proposal credits: balance and buying packs from the seller balance.
const creditsSvc = require("../../services/credits.service");
const catchAsyncC = require("../../utils/catchAsync");
router.get("/credits/me", auth("withOutAdmin"), catchAsyncC(async (req, res) => res.json({ code: 200, message: "Credits", data: { attributes: await creditsSvc.summary(req.user.id) } })));
router.post("/credits/buy", auth("withOutAdmin"), catchAsyncC(async (req, res) => res.json({ code: 200, message: "Credits bought", data: { attributes: await creditsSvc.buy(req.user.id, req.body?.packs) } })));
router.get("/invites/mine", auth("withOutAdmin"), catchAsyncC(async (req, res) => res.json({ code: 200, message: "Invites", data: { attributes: await require("../../services/buyerRequest.service").listMyInvites(req.user) } })));
router.post("/:requestId/invite", auth("withOutAdmin"), catchAsyncC(async (req, res) => res.status(201).json({ code: 201, message: "Seller invited", data: { attributes: await require("../../services/buyerRequest.service").inviteSeller(req.params.requestId, req.user, req.body?.sellerId) } })));
router.get("/offers/mine", auth("withOutAdmin"), c.listMyOffers);
router.post("/offers/:offerId/withdraw", auth("withOutAdmin"), c.withdrawOffer);
router.post("/offers/:offerId/decline", auth("withOutAdmin"), c.declineOffer);
router.route("/:requestId").get(optionalAuth(), c.getRequest).patch(auth("withOutAdmin"), c.updateRequest);
router.post("/:requestId/offers", auth("withOutAdmin"), c.createOffer);

module.exports = router;
