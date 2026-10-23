const express = require("express");
const catchAsync = require("../../utils/catchAsync");
const talent = require("../../services/talent.service");

const router = express.Router();
router.get("/", catchAsync(async (req, res) => res.json({ code: 200, message: "Talent", data: { attributes: await talent.search(req.query) } })));
module.exports = router;
