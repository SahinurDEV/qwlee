const express = require("express");
const auth = require("../../middlewares/auth");
const withdrawalController = require("../../controllers/withdrawal.controller");

const router = express.Router();

router
  .route("/my")
  .get(auth("freelancer"), withdrawalController.getSingleUserWithdrawals);
router
  .route("/single")
  .get(auth("admin"), withdrawalController.getSingleWithdrawal);
router
  .route("/")
  // Admin-only: this lists every user's payout bank details (was public).
  .get(auth("admin"), withdrawalController.getWithdrawals)
  .post(auth("freelancer"), withdrawalController.createWithdrawal);

router
  .route("/:withdrawalId")
  // Admin-only: approving/declining payouts. (Was "common", which let
  // any signed-in user approve or repeatedly decline-and-refund.)
  .patch(auth("admin"), withdrawalController.withdrawalCancel)
  .post(auth("admin"), withdrawalController.withdrawalApprove);

module.exports = router;
