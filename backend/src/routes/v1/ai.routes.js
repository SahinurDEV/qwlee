const express = require("express");
const auth = require("../../middlewares/auth");
const catchAsync = require("../../utils/catchAsync");
const ai = require("../../services/ai.service");

const router = express.Router();
const ok = (fn) => catchAsync(async (req, res) => res.json({ code: 200, message: "OK", data: { attributes: await fn(req) } }));
router.get("/status", (req, res) => res.json({ code: 200, message: "AI", data: { attributes: { enabled: ai.enabled(), provider: ai.provider() } } }));
router.post("/gig-description", auth("withOutAdmin"), ok((req) => ai.gigDescription(req.body)));
router.post("/brief", auth("withOutAdmin"), ok((req) => ai.brief(req.body)));
router.post("/replies", auth("withOutAdmin"), ok((req) => ai.replies(req.body)));
router.get("/match/:requestId", auth("withOutAdmin"), ok((req) => ai.match(req.params.requestId, req.user)));
module.exports = router;
