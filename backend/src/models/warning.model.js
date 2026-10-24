// Policy warnings issued to a user by the trust & safety team. Active
// warnings (not expired, not revoked) drive escalation; see trust.service.
const mongoose = require("mongoose");

const REASONS = ["off_platform", "spam", "harassment", "prohibited_service", "fake_reviews", "ip", "misleading", "other"];

const warningSchema = mongoose.Schema(
  {
    userId: { type: mongoose.SchemaTypes.ObjectId, ref: "User", required: true, index: true },
    reason: { type: String, enum: REASONS, required: true },
    note: { type: String, default: "", maxlength: 1000 },
    issuedBy: { type: mongoose.SchemaTypes.ObjectId, ref: "User", default: null },
    source: { type: String, default: "admin" }, // admin | risk-flag | system
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    escalation: { type: String, default: "" }, // "", "restricted", "suspended"
  },
  { timestamps: true }
);

const Warning = mongoose.model("Warning", warningSchema);
Warning.REASONS = REASONS;
module.exports = Warning;
