const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

// One row per admin action (every non-GET admin request, plus sensitive
// reads such as viewing a user's account or private conversations).
const adminAuditSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.SchemaTypes.ObjectId, ref: "User", index: true },
    adminEmail: { type: String, default: "" },
    adminRole: { type: String, default: "" },
    action: { type: String, index: true }, // e.g. "PATCH /admin/users/:id/ban"
    method: String,
    path: String,
    targetId: { type: String, default: "", index: true },
    permission: { type: String, default: "" },
    body: { type: Object, default: {} },
    status: Number,
    ok: Boolean,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
adminAuditSchema.index({ createdAt: -1 });
adminAuditSchema.plugin(toJSON);
adminAuditSchema.plugin(paginate);
module.exports = mongoose.model("AdminAudit", adminAuditSchema);
