const express = require("express");
const auth = require("../../middlewares/auth");
const activityController = require("../../controllers/activity.controller");

const router = express.Router();

// Self-report: any signed-in non-admin user (or the admin themselves)
// can post their own page-view events. The userId comes from the token
// so the body can never reference someone else.
// navigator.sendBeacon (used on tab close) can't set headers, so the
// client puts the JWT in the body as `_bearer`; lift it into the header.
function beaconBearer(req, res, next) {
  const b = req.body && typeof req.body._bearer === "string" ? req.body._bearer : "";
  if (!req.headers.authorization && b) req.headers.authorization = `Bearer ${b}`;
  if (req.body) delete req.body._bearer;
  next();
}
router.post("/track", beaconBearer, auth("common"), activityController.track);

module.exports = router;
