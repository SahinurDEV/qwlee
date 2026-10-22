// Signed-in devices: list, sign one out, sign out all others.
// (Not under /auth, whose limiter counts refused requests.)
const express = require("express");
const auth = require("../../middlewares/auth");
const catchAsync = require("../../utils/catchAsync");
const sessions = require("../../services/session.service");

const router = express.Router();
router.get("/", auth("common"), catchAsync(async (req, res) => {
  const rows = await sessions.list(req.user._id);
  res.json({ code: 200, message: "Sessions", data: { attributes: { results: rows.map((r) => sessions.view(r, req.user.$locals.sid)) } } });
}));
router.post("/revoke-others", auth("common"), catchAsync(async (req, res) => {
  const n = await sessions.revokeOthers(req.user._id, req.user.$locals.sid);
  res.json({ code: 200, message: `Signed out ${n} other device(s)`, data: { attributes: { revoked: n } } });
}));
router.delete("/:sid", auth("common"), catchAsync(async (req, res) => {
  const ok = await sessions.revoke(req.user._id, String(req.params.sid), req.user._id);
  res.status(ok ? 200 : 404).json({ code: ok ? 200 : 404, message: ok ? "Signed out on that device" : "Session not found" });
}));
module.exports = router;
