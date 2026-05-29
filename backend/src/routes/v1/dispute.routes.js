const express = require("express");
const auth = require("../../middlewares/auth");
const disputeController = require("../../controllers/dispute.controller");

const router = express.Router();

// User-facing
router.post("/", auth("common"), disputeController.openDispute);
router.get("/my", auth("common"), disputeController.getMyDisputes);
router.get("/:disputeId", auth("common"), disputeController.getDisputeById);
router.post("/:disputeId/respond", auth("common"), disputeController.respondToDispute);
router.post("/:disputeId/escalate", auth("common"), disputeController.escalateDispute);
router.post("/:disputeId/cancel", auth("common"), disputeController.cancelDispute);

// Admin
router.get("/", auth("admin"), disputeController.getDisputesAdmin);
router.post("/:disputeId/resolve", auth("admin"), disputeController.resolveDispute);

module.exports = router;
