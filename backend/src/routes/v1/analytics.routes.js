const express = require("express");
const auth = require("../../middlewares/auth");
const catchAsync = require("../../utils/catchAsync");

const router = express.Router();

// Seller analytics (?days=7|30|90|365).
router.get("/seller", auth("freelancer"), catchAsync(async (req, res) => {
  const days = [7, 30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const data = await require("../../services/sellerAnalytics.service").forSeller(req.user._id, days);
  res.json({ code: 200, message: "Analytics", data: { attributes: data } });
}));

module.exports = router;
