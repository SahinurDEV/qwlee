const express = require("express");
const auth = require("../../middlewares/auth");
const withdrawalController = require("../../controllers/withdrawal.controller");

const router = express.Router();

router
  .route("/my")
  .get(auth("freelancer"), withdrawalController.getSingleUserWithdrawals);
// Which payout methods are live (real provider) or demo.
router.get("/methods", auth("common"), (req, res) =>
  res.json({ code: 200, message: "OK", data: { attributes: { bank: "manual", ...require("../../services/payouts.service").status() } } }));
// Earnings still waiting out the clearance period.
router.get("/clearance", auth("common"), require("../../utils/catchAsync")(async (req, res) =>
  res.json({ code: 200, message: "Clearance", data: { attributes: await require("../../services/clearance.service").summary(req.user.id) } })));
// Finance: batch approve, bank CSV export, bank statement reconciliation.
const batch = require("../../services/payoutBatch.service");
const catchAsync = require("../../utils/catchAsync");
router.post("/batch/approve", auth("admin"), catchAsync(async (req, res) =>
  res.json({ code: 200, message: "Batch processed", data: { attributes: await batch.approveBatch(req.body?.ids) } })));
router.get("/export/bank.csv", auth("admin"), catchAsync(async (req, res) => {
  const { csv, count, total } = await batch.bankCsv({ status: req.query.status || "Pending" });
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="bank-payouts-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.set("X-Row-Count", String(count));
  res.set("X-Total-Usd", total.toFixed(2));
  res.send(csv);
}));
router.post("/reconcile", auth("admin"), catchAsync(async (req, res) =>
  res.json({ code: 200, message: "Reconciled", data: { attributes: await batch.reconcile(req.body?.csv, { dryRun: !!req.body?.dryRun }) } })));
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
