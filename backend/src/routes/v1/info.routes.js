const express = require("express");
const auth = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const infoController = require("../../controllers/info.controller");

const router = express.Router();

router
  .route("/privacy")
  .post(auth("admin"), infoController.createPrivacy)
  .get(infoController.queryPrivacy);
router
  .route("/terms")
  .post(auth("admin"), infoController.createTerms)
  .get(infoController.queryTerms);
router
  .route("/trust-safety")
  .post(auth("admin"), infoController.createTrustSafety)
  .get(infoController.queryTrustSafety);

// Public marketplace counters for the homepage stat strip.
router.route("/stats").get(infoController.getStats);

// Public site settings (branding, homepage, SEO, feature toggles).
router.get("/site", require("../../controllers/adminControl.controller").publicSite);

// Visitor's approximate country (for the sign-up form). Never errors.
router.get("/geo", async (req, res) => {
  const data = await require("../../services/geo.service").lookup(req);
  res.set("Cache-Control", "private, max-age=3600");
  res.json({ code: 200, message: "OK", data: { attributes: data || { country: null, countryCode: null, city: null, region: null } } });
});

module.exports = router;
