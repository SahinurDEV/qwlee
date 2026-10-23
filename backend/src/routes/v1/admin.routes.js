const express = require("express");
const auth = require("../../middlewares/auth");
const adminController = require("../../controllers/admin.controller");
const activityController = require("../../controllers/activity.controller");
const router = express.Router();
router.get("/getTotalStatus", auth("admin"), adminController.getTotalStatus);
router.get("/getIncomeRatio", auth("admin"), adminController.getIncomeRatio);
router.get("/getUserRatio", auth("admin"), adminController.getUserRatio);
router.get("/recentUsers", auth("admin"), adminController.getRecentUsers);
router.get("/earnings", auth("admin"), adminController.getAllEarning);
router.get("/orders", auth("admin"), adminController.getAllOrders);
router.get("/gigs", auth("admin"), adminController.getAllGigs);

// Per-user activity feed (timeline + per-route + per-IP rollups) for
// the admin "monitor user" page.
router.get(
  "/user-activity/:userId",
  auth("admin"),
  activityController.getUserActivity
);

// Ban / unban a user. Ban payload accepts an optional `reason` string.
router.patch("/users/:userId/ban", auth("admin"), adminController.banUser);
router.patch("/users/:userId/unban", auth("admin"), adminController.unbanUser);

// Admin force-cancel — works on any order regardless of status. Optional
// `reason` is shown in the cancellation email to both parties.
router.patch(
  "/orders/:orderId/cancel",
  auth("admin"),
  adminController.cancelOrder
);

// Admin opens a support ticket on behalf of users. Either pass orderId
// (auto-resolves buyer + seller) or an explicit participantIds array.
const supportController = require("../../controllers/support.controller");
router.post(
  "/support/tickets",
  auth("admin"),
  supportController.adminCreateTicket
);

// Gig moderation — flip a gig's status (approve / deny / request
// modification / pause). Reason is shown to the seller on the next
// dashboard load.
const adminGigController = require("../../controllers/adminGig.controller");
router.patch(
  "/gigs/:gigId/status",
  auth("admin"),
  adminGigController.updateGigStatus
);
router.delete("/gigs/:gigId", auth("admin"), adminGigController.deleteGig);
router.patch(
  "/gigs/:gigId/restore",
  auth("admin"),
  adminGigController.restoreGig
);

// Admin search logs — every marketplace query (anonymous + authed).
const searchController = require("../../controllers/search.controller");
router.get("/searches", auth("admin"), searchController.list);
router.get("/search-stats", auth("admin"), searchController.adminStats);

// Platform settings — payment provider credentials, SMTP, custom
// methods, misc. Admin-only since these contain secrets.
const appConfigController = require("../../controllers/appConfig.controller");
router.get("/settings", auth("admin"), appConfigController.getSettings);
router.patch("/settings", auth("admin"), appConfigController.updateSettings);
router.post(
  "/settings/custom-payments",
  auth("admin"),
  appConfigController.addCustomPayment
);
router.delete(
  "/settings/custom-payments/:id",
  auth("admin"),
  appConfigController.removeCustomPayment
);
// Email template preview — send a sample to any address.
router.post(
  "/settings/test-email",
  auth("admin"),
  appConfigController.sendTemplateSample
);

// Read-only access to platform conversations (DMs + order chats) for
// moderation. No write endpoints — admins observe, they don't post.
const adminChatsController = require("../../controllers/adminChats.controller");
router.get("/chats", auth("admin"), adminChatsController.listDirectChats);
router.get(
  "/chats/:chatId/messages",
  auth("admin"),
  adminChatsController.getDirectChat
);
router.get("/order-chats", auth("admin"), adminChatsController.listOrderChats);
router.get(
  "/order-chats/:orderId/messages",
  auth("admin"),
  adminChatsController.getOrderChat
);

// Seller level controls — list every seller's level, edit the tier
// thresholds globally, or pin a single seller to a specific tier.
const adminLevelController = require("../../controllers/adminLevel.controller");
router.get("/seller-levels", auth("admin"), adminLevelController.listSellerLevels);
router.get("/seller-levels/tiers", auth("admin"), adminLevelController.getTiers);
router.patch("/seller-levels/tiers", auth("admin"), adminLevelController.updateTiers);
router.patch(
  "/seller-levels/:userId/override",
  auth("admin"),
  adminLevelController.setOverride
);

// ---- Full-control endpoints (permissions + audit: config/adminPermissions.js)
const ac = require("../../controllers/adminControl.controller");
const A = auth("admin");
router.get("/me", A, ac.me);
router.get("/users", A, ac.listUsers);
router.patch("/users/:userId", A, ac.updateUser);
router.patch("/users/:userId/role", A, ac.setRole);
router.post("/users/:userId/reset-password", A, ac.resetPassword);
router.post("/users/:userId/logout-all", A, ac.logoutEverywhere);
router.get("/users/:userId/sessions", A, ac.userSessions);
router.delete("/users/:userId/sessions/:sid", A, ac.revokeUserSession);
router.get("/users/:userId/view", A, ac.viewUser);
router.patch("/gigs/:gigId/feature", A, ac.featureGig);
router.patch("/gigs/:gigId", A, ac.editGig);
router.get("/orders/:orderId", A, ac.getOrder);
const secondApproval = require("../../middlewares/secondApproval");
router.post(
  "/orders/:orderId/refund",
  A,
  secondApproval("refund", async (req) => {
    const { Payment } = require("../../models");
    if (!require("mongoose").isValidObjectId(req.params.orderId)) return null;
    const o = await Payment.findById(req.params.orderId).select("price escrow").lean();
    return o && { id: o._id, amount: Number(o.escrow?.amount ?? o.price ?? 0), summary: `Refund order ${o._id}` };
  }),
  ac.refundOrder
);
router.post(
  "/orders/:orderId/tips/:tipId/refund",
  A,
  secondApproval("tip-refund", async (req) => {
    const { Payment } = require("../../models");
    if (!require("mongoose").isValidObjectId(req.params.orderId)) return null;
    const o = await Payment.findById(req.params.orderId).select("tips").lean();
    const t = (o?.tips || []).find((x) => x.sessionId === req.params.tipId);
    return t && { id: `${o._id}:${t.sessionId}`, amount: Number(t.amount || 0), summary: `Refund $${t.amount} tip on order ${o._id}` };
  }),
  ac.refundTip
);
const coupons = require("../../controllers/coupons.controller");
router.get("/coupons", A, coupons.list);
router.post("/coupons", A, coupons.create);
router.patch("/coupons/:id", A, coupons.update);
// Help centre / FAQ articles (content role).
const helpSvc = require("../../services/help.service");
const catchAsync2 = require("../../utils/catchAsync");
const helpOk = (res, attributes, message = "OK") => res.json({ code: 200, message, data: { attributes } });
router.get("/help", A, catchAsync2(async (req, res) => helpOk(res, { results: await helpSvc.adminList(req.query) })));
router.post("/help", A, catchAsync2(async (req, res) => helpOk(res, await helpSvc.create(req.body, req.user._id), "Article created")));
router.patch("/help/:id", A, catchAsync2(async (req, res) => helpOk(res, await helpSvc.update(req.params.id, req.body, req.user._id), "Article saved")));
router.delete("/help/:id", A, catchAsync2(async (req, res) => {
  await helpSvc.remove(req.params.id);
  helpOk(res, { deleted: true }, "Article deleted");
}));
const approvals = require("../../controllers/approvals.controller");
router.get("/approvals", A, approvals.list);
router.post("/approvals/:id/approve", A, approvals.approve);
router.post("/approvals/:id/reject", A, approvals.reject);
router.post("/orders/:orderId/complete", A, ac.forceComplete);
router.get("/escrow", A, ac.escrowSummary);
router.get("/payments", A, ac.listPayments);
router.get("/requests", A, ac.listRequests);
router.patch("/requests/:requestId", A, ac.moderateRequest);
router.delete("/requests/:requestId", A, ac.deleteRequest);
router.get("/offers", A, ac.listOffers);
router.delete("/offers/:offerId", A, ac.removeOffer);
router.get("/reviews", A, ac.listReviews);
router.delete("/reviews/:reviewId", A, ac.deleteReview);
router.get("/settings/site", A, ac.getSite);
// Run subscription billing now (super admin). `asOf` bills as if it were that time.
router.post("/jobs/subscriptions", A, require("../../utils/catchAsync")(async (req, res) => {
  const asOf = req.body?.asOf ? new Date(req.body.asOf) : new Date();
  if (Number.isNaN(asOf.getTime())) return res.status(400).json({ code: 400, message: "Invalid asOf" });
  res.json({ code: 200, message: "OK", data: { attributes: await require("../../services/subscription.service").billDue(asOf) } });
}));
// Send scheduled announcements now (super admin). `asOf` sends as if it were that time.
router.post("/jobs/announcements", A, require("../../utils/catchAsync")(async (req, res) => {
  const asOf = req.body?.asOf ? new Date(req.body.asOf) : new Date();
  if (Number.isNaN(asOf.getTime())) return res.status(400).json({ code: 400, message: "Invalid asOf" });
  res.json({ code: 200, message: "OK", data: { attributes: { sent: await require("../../services/announcements.service").sendDue(asOf) } } });
}));
router.patch("/settings/site", A, ac.updateSite);
// Orphaned local uploads: GET = dry run, POST = delete.
router.get("/settings/storage/orphans", A, ac.storageOrphans);
router.post("/settings/storage/orphans", A, ac.storageOrphans);
router.post("/broadcast", A, ac.broadcast);
router.get("/broadcast", A, ac.listBroadcasts);
const annSvc = require("../../services/announcements.service");
const annOk = (res, attributes, message = "OK") => res.json({ code: 200, message, data: { attributes } });
const annId = (req, res) => require("mongoose").isValidObjectId(req.params.id) || (res.status(400).json({ code: 400, message: "Invalid id" }), false);
router.post("/broadcast/preview", A, require("../../utils/catchAsync")(async (req, res) => annOk(res, await annSvc.preview(req.body || {}))));
router.patch("/broadcast/:id", A, require("../../utils/catchAsync")(async (req, res) => annId(req, res) && annOk(res, await annSvc.update(req.params.id, req.body || {}), "Saved")));
router.post("/broadcast/:id/cancel", A, require("../../utils/catchAsync")(async (req, res) => annId(req, res) && annOk(res, await annSvc.cancel(req.params.id), "Cancelled")));
router.get("/analytics", A, ac.analytics);
router.get("/audit", A, ac.auditLog);
router.get("/team", A, ac.team);
router.get("/2fa", A, ac.twoFaStatus);
router.post("/2fa/setup", A, ac.twoFaSetup);
router.post("/2fa/enable", A, ac.twoFaEnable);
router.post("/2fa/disable", A, ac.twoFaDisable);
router.post("/team/:id/reset-2fa", A, ac.twoFaReset);
router.get("/newsletter", A, ac.listSubscribers);
// Custom admin roles (settings permission).
const rolesSvc = require("../../services/adminRoles.service");
const roleId = (req, res) => require("mongoose").isValidObjectId(req.params.id) || (res.status(400).json({ code: 400, message: "Invalid id" }), false);
router.get("/roles", A, catchAsync2(async (req, res) => helpOk(res, await rolesSvc.list())));
router.post("/roles", A, catchAsync2(async (req, res) => helpOk(res, await rolesSvc.create(req.body || {}), "Role created")));
router.patch("/roles/:id", A, catchAsync2(async (req, res) => roleId(req, res) && helpOk(res, await rolesSvc.update(req.params.id, req.body || {}), "Role saved")));
router.delete("/roles/:id", A, catchAsync2(async (req, res) => roleId(req, res) && helpOk(res, await rolesSvc.remove(req.params.id), "Role deleted")));
// Ban appeals and bulk actions.
const modSvc = require("../../services/moderation.service");
router.get("/appeals", A, catchAsync2(async (req, res) => helpOk(res, await modSvc.listAppeals(req.query))));
router.patch("/appeals/:id", A, catchAsync2(async (req, res) => {
  if (!require("mongoose").isValidObjectId(req.params.id)) return res.status(400).json({ code: 400, message: "Invalid id" });
  helpOk(res, await modSvc.decideAppeal(req.params.id, req.body || {}, req.user), "Appeal decided");
}));
router.post("/bulk/users", A, catchAsync2(async (req, res) => helpOk(res, await modSvc.bulkUsers(req.body?.ids, req.body || {}, req.user), "Done")));
router.post("/bulk/gigs", A, catchAsync2(async (req, res) => helpOk(res, await modSvc.bulkGigs(req.body?.ids, req.body || {}, req.user), "Done")));
// Risk flags (keyword filters, off-platform contact, order rules).
const riskSvc = require("../../services/risk.service");
router.get("/risk-flags", A, catchAsync2(async (req, res) => helpOk(res, await riskSvc.list(req.query))));
router.patch("/risk-flags/:id", A, catchAsync2(async (req, res) => {
  if (!require("mongoose").isValidObjectId(req.params.id)) return res.status(400).json({ code: 400, message: "Invalid id" });
  helpOk(res, await riskSvc.review(req.params.id, req.body || {}, req.user), "Flag updated");
}));

// Canned replies for the support inbox (support permission for writes).
const CannedReply = require("../../models/cannedReply.model");
const ApiError = require("../../utils/ApiError");
const cannedBody = (b = {}) => {
  const title = String(b.title || "").trim().slice(0, 80);
  const body = String(b.body || "").trim().slice(0, 4000);
  if (!title || !body) throw new ApiError(400, "Title and text are required");
  return { title, body };
};
router.get("/support/canned", A, catchAsync2(async (req, res) => helpOk(res, { results: await CannedReply.find().sort({ title: 1 }).limit(200).lean() })));
router.post("/support/canned", A, catchAsync2(async (req, res) => {
  if ((await CannedReply.countDocuments()) >= 200) throw new ApiError(400, "At most 200 canned replies");
  helpOk(res, { reply: await CannedReply.create({ ...cannedBody(req.body), createdBy: req.user._id }) }, "Saved");
}));
router.patch("/support/canned/:id", A, catchAsync2(async (req, res) => {
  const r = await CannedReply.findByIdAndUpdate(req.params.id, cannedBody(req.body), { new: true, runValidators: true });
  if (!r) throw new ApiError(404, "Not found");
  helpOk(res, { reply: r }, "Saved");
}));
router.delete("/support/canned/:id", A, catchAsync2(async (req, res) => {
  if (!(await CannedReply.findByIdAndDelete(req.params.id))) throw new ApiError(404, "Not found");
  helpOk(res, {}, "Deleted");
}));

// Funnels, signup cohorts, weekly KPI summary (+ manual email, super only).
const kpi = require("../../services/kpi.service");
router.get("/kpi/funnel", A, catchAsync2(async (req, res) => helpOk(res, await kpi.funnel(req.query))));
router.get("/kpi/cohorts", A, catchAsync2(async (req, res) => helpOk(res, await kpi.cohorts(req.query))));
router.get("/kpi/weekly", A, catchAsync2(async (req, res) => helpOk(res, await kpi.weeklySummary())));
router.post("/jobs/kpi-email", A, catchAsync2(async (req, res) => helpOk(res, await kpi.sendWeekly({ force: true }), "Weekly report sent")));

// Job monitor (any admin reads; running housekeeping now is super only).
const jobsSvc = require("../../services/jobs.service");
router.get("/jobs/status", A, catchAsync2(async (req, res) => helpOk(res, await jobsSvc.status())));
router.get("/jobs/history", A, catchAsync2(async (req, res) => helpOk(res, { results: await jobsSvc.history(req.query.job, req.query.limit) })));
router.post("/jobs/housekeeping", A, catchAsync2(async (req, res) => helpOk(res, await require("../../services/orderLifecycle.service").runHousekeeping({ trigger: "manual" }), "Housekeeping ran")));

// Personal data on behalf of a user (super only; see adminPermissions).
const privacySvc = require("../../services/privacy.service");
router.get("/privacy/:id/export", A, catchAsync2(async (req, res) => {
  res.set("Content-Disposition", `attachment; filename="user-${req.params.id}-data.json"`);
  res.set("Cache-Control", "no-store");
  res.json(await privacySvc.exportUser(req.params.id));
}));
router.post("/privacy/:id/erase", A, catchAsync2(async (req, res) => {
  if (req.body?.confirm !== "ERASE") throw new ApiError(400, "Send confirm: ERASE");
  helpOk(res, await privacySvc.eraseUser(req.params.id, { by: `admin ${req.user._id}` }), "Account erased");
}));

// Backups (settings permission to view; super to request a backup now).
const backupsSvc = require("../../services/backups.service");
router.get("/backups", A, catchAsync2(async (req, res) => helpOk(res, await backupsSvc.status())));
router.post("/backups/run", A, catchAsync2(async (req, res) => helpOk(res, await backupsSvc.requestNow(), "Backup requested")));

// Email template editor (settings permission).
const tplSvc = require("../../services/emailTemplates.service");
router.get("/email-templates", A, catchAsync2(async (req, res) => helpOk(res, { results: await tplSvc.list() })));
router.post("/email-templates/:key/preview", A, catchAsync2(async (req, res) => helpOk(res, await tplSvc.preview(req.params.key, req.body?.draft))));
router.put("/email-templates/:key", A, catchAsync2(async (req, res) => helpOk(res, { template: await tplSvc.save(req.params.key, req.body, req.user._id) }, "Template saved")));
router.delete("/email-templates/:key", A, catchAsync2(async (req, res) => helpOk(res, await tplSvc.reset(req.params.key), "Template reset")));
router.post("/email-templates/:key/test", A, catchAsync2(async (req, res) => helpOk(res, await tplSvc.testSend(req.params.key, req.user.email), "Test email sent")));

module.exports = router;
