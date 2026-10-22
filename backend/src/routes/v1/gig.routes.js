const express = require("express");
const auth = require("../../middlewares/auth");
const optionalAuth = require("../../middlewares/optionalAuth");
const gigController = require("../../controllers/gig.controller");
const gigLoveController = require("../../controllers/gigLove.controller");
const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const imgbbUpload = require("../../middlewares/imgbbUpload");

const upload = userFileUploadMiddleware();
const router = express.Router();

// Wishlist works in both modes — a freelancer browsing as a buyer (via
// the navbar mode toggle) should also be able to save gigs. Gate by
// "common" so any signed-in non-admin can hit these.
router
  .route("/love")
  .post(auth("common"), gigLoveController.gigLove)
  .put(auth("common"), gigLoveController.gigUnlove)
  .get(auth("common"), gigLoveController.gigLoveList);
router.route("/public").get(gigController.publicGigs);

// Does a (non-deleted) gig with this slug exist at all? Lets the web
// app return a real 404 for unknown slugs while still rendering a
// seller's own pending/paused gig for them.
router.get("/slug-exists", async (req, res, next) => {
  try {
    const { Gig } = require("../../models");
    const slug = String(req.query.slug || "").slice(0, 300);
    const found = slug ? await Gig.exists({ slug, isDeleted: { $ne: true } }) : null;
    res.json({ code: 200, message: "OK", data: { attributes: { exists: !!found } } });
  } catch (e) {
    next(e);
  }
});

// Seller-facing dashboard endpoints — level overview + my-gigs stats.
const sellerLevelController = require("../../controllers/sellerLevel.controller");
router.get(
  "/mine/level",
  auth("freelancer"),
  sellerLevelController.myLevelOverview
);
router.get(
  "/mine/stats",
  auth("freelancer"),
  sellerLevelController.myGigsStats
);

// Public impression tracker — frontend fire-and-forget on a gig view.
// Atomic $inc so concurrent views don't lose count. Kept open (no
// auth) since anonymous visitors browse gigs.
const impressionController = require("../../controllers/gigImpression.controller");
router.post("/:gigId/impression", impressionController.bumpImpression);
router.post("/:gigId/click", impressionController.bumpClick);
router
  .route("/image")
  .post(
    auth("freelancer"),
    upload.array("images", 6),
    imgbbUpload(),
    gigController.gigImageUpload
  );
router
  .route("/")
  .post(
    auth("freelancer"),
    upload.array("images", 6),
    imgbbUpload({ optional: false }),
    gigController.createGig
  )
  .delete(auth("freelancer"), gigController.gigSingleImageDelete)
  .get(optionalAuth(), gigController.getGigs);
router
  .route("/:gigId")
  .get(gigController.getGig)
  .patch(auth("freelancer"), gigController.updateGig)
  .delete(auth("freelancer"), gigController.deleteGig);

module.exports = router;
