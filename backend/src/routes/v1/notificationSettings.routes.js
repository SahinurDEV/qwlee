// Notification preferences and browser push subscriptions.
const express = require("express");
const auth = require("../../middlewares/auth");
const catchAsync = require("../../utils/catchAsync");
const prefs = require("../../services/notificationPrefs.service");
const push = require("../../services/push.service");

const router = express.Router();
const ok = (res, attributes, message = "OK", code = 200) => res.status(code).json({ code, message, data: { attributes } });

router.get("/", auth("common"), catchAsync(async (req, res) => {
  ok(res, {
    prefs: await prefs.get(req.user._id),
    categories: prefs.CATEGORIES,
    emailLocked: prefs.EMAIL_LOCKED,
    push: { ...push.config(), devices: await push.count(req.user._id) },
  });
}));
router.patch("/", auth("common"), catchAsync(async (req, res) => {
  ok(res, { prefs: await prefs.update(req.user._id, req.body || {}) }, "Notification settings saved");
}));
router.get("/push", catchAsync(async (req, res) => ok(res, push.config())));
router.post("/push/subscribe", auth("common"), catchAsync(async (req, res) => {
  const r = await push.subscribe(req.user._id, req.body?.subscription || req.body, req.headers["user-agent"]);
  if (r.error) return ok(res, {}, r.error, 400);
  ok(res, { devices: await push.count(req.user._id) }, "This browser will get notifications");
}));
router.post("/push/unsubscribe", auth("common"), catchAsync(async (req, res) => {
  await push.unsubscribe(req.user._id, req.body?.endpoint);
  ok(res, { devices: await push.count(req.user._id) }, "Browser notifications off for this browser");
}));
router.post("/push/test", auth("common"), catchAsync(async (req, res) => {
  const sent = await push.notifyUser(req.user._id, null, { title: "Qwlee", body: "Browser notifications are working.", url: "/notifications/settings" });
  ok(res, { sent, enabled: push.isEnabled() }, push.isEnabled() ? `Sent to ${sent} browser(s)` : "Push is not configured on this server (demo mode: logged only)");
}));
module.exports = router;
