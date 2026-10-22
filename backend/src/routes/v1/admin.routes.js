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
router.get("/users/:userId/view", A, ac.viewUser);
router.patch("/gigs/:gigId/feature", A, ac.featureGig);
router.patch("/gigs/:gigId", A, ac.editGig);
router.get("/orders/:orderId", A, ac.getOrder);
router.post("/orders/:orderId/refund", A, ac.refundOrder);
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
router.patch("/settings/site", A, ac.updateSite);
router.post("/broadcast", A, ac.broadcast);
router.get("/broadcast", A, ac.listBroadcasts);
router.get("/analytics", A, ac.analytics);
router.get("/audit", A, ac.auditLog);
router.get("/team", A, ac.team);
router.get("/2fa", A, ac.twoFaStatus);
router.post("/2fa/setup", A, ac.twoFaSetup);
router.post("/2fa/enable", A, ac.twoFaEnable);
router.post("/2fa/disable", A, ac.twoFaDisable);
router.post("/team/:id/reset-2fa", A, ac.twoFaReset);

module.exports = router;
