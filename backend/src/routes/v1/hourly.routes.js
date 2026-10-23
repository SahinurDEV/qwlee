const express = require("express");
const auth = require("../../middlewares/auth");
const catchAsync = require("../../utils/catchAsync");
const svc = require("../../services/hourly.service");

const router = express.Router();
const ok = (res, attributes, message = "OK", code = 200) => res.status(code).json({ code, message, data: { attributes } });
const U = auth("common");

router.get("/", U, catchAsync(async (req, res) => ok(res, await svc.listMine(req.user))));
router.post("/", U, catchAsync(async (req, res) => ok(res, await svc.create(req.user, req.body || {}), "Contract offered", 201)));
router.post("/wallet/topup", U, catchAsync(async (req, res) => ok(res, await svc.demoTopUp(req.user, req.body?.amount), "Balance topped up")));
router.get("/:id", U, catchAsync(async (req, res) => ok(res, await svc.getOne(req.params.id, req.user))));
router.post("/:id/accept", U, catchAsync(async (req, res) => ok(res, await svc.respond(req.params.id, req.user, true), "Accepted")));
router.post("/:id/decline", U, catchAsync(async (req, res) => ok(res, await svc.respond(req.params.id, req.user, false), "Declined")));
for (const a of ["end", "pause", "resume"]) {
  router.post(`/:id/${a}`, U, catchAsync(async (req, res) => ok(res, await svc.setStatus(req.params.id, req.user, a))));
}
router.post("/:id/time", U, catchAsync(async (req, res) => ok(res, await svc.logTime(req.params.id, req.user, req.body || {}), "Time logged", 201)));
router.delete("/:id/time/:entryId", U, catchAsync(async (req, res) => ok(res, await svc.deleteTime(req.params.id, req.user, req.params.entryId), "Removed")));
for (const a of ["approve", "dispute", "pay"]) {
  router.post(`/:id/invoices/:invId/${a}`, U, catchAsync(async (req, res) => ok(res, await svc.invoiceAction(req.params.id, req.user, req.params.invId, a, req.body?.reason))));
}

module.exports = router;
