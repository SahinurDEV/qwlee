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
  .post(
    auth("admin"),
    require("../../middlewares/secondApproval")("withdrawal", async (req) => {
      const { Withdrawal } = require("../../models");
      if (!require("mongoose").isValidObjectId(req.params.withdrawalId)) return null;
      const w = await Withdrawal.findById(req.params.withdrawalId).select("withdrawalAmount status").lean();
      return w && w.status === "Pending" && { id: w._id, amount: Number(w.withdrawalAmount || 0), summary: `Payout ${w._id}` };
    }),
    withdrawalController.withdrawalApprove
  );

module.exports = router;
