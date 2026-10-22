// Four-eyes control. When the "second approval over" setting is on and the
// money involved is at or above it, the first admin's request is parked as
// an Approval (HTTP 202). A *different* admin with the same permission
// approves it from Admin → Approvals, which replays the original request
// with the approver's credentials (so the audit log shows both people).
const httpStatus = require("http-status");
const { Approval } = require("../models");
const siteSettings = require("../services/siteSettings.service");

function secondApproval(kind, getTarget) {
  return async (req, res, next) => {
    try {
      const site = await siteSettings.get();
      const limit = Number(site.marketplace?.secondApprovalOver || 0);
      if (!limit) return next();
      const target = await getTarget(req);
      if (!target || Number(target.amount || 0) < limit) return next();
      const targetId = String(target.id);
      // Replayed by the approver: consume the approval and let it through.
      const token = req.get("x-approval-id");
      if (token) {
        const ok = await Approval.findOneAndUpdate(
          { _id: token, kind, targetId, status: "approved", consumed: false, decidedBy: req.user._id },
          { $set: { consumed: true } },
          { new: true }
        );
        if (ok) return next();
      }
      let ap = await Approval.findOne({ kind, targetId, status: "pending" });
      if (!ap) {
        ap = await Approval.create({
          kind,
          targetId,
          amount: target.amount,
          method: req.method,
          path: (req.originalUrl || "").split("?")[0].replace(/^\/(api\/)?v1/, ""),
          body: req.body || {},
          summary: target.summary || "",
          requestedBy: req.user._id,
        });
      }
      return res.status(httpStatus.ACCEPTED).json({
        code: 202,
        message: `Amounts of $${limit} or more need a second admin's approval. Request sent.`,
        data: { attributes: { approval: ap.toJSON(), needsApproval: true } },
      });
    } catch (e) {
      next(e);
    }
  };
}

module.exports = secondApproval;
