// One row per signed-in device. Access and refresh tokens carry the
// session id (sid) so a single device can be signed out.
const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    sid: { type: String, required: true, unique: true },
    user: { type: mongoose.SchemaTypes.ObjectId, ref: "User", required: true, index: true },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: mongoose.SchemaTypes.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
// Expired rows are removed by Mongo a week after they lapse.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 86400 });

module.exports = mongoose.model("Session", sessionSchema);
