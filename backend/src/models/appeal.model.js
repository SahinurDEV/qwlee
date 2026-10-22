const mongoose = require("mongoose");
const { toJSON, paginate } = require("./plugins");

// A banned user's request to lift their suspension (moderation.service).
const appealSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.SchemaTypes.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    banReason: { type: String, default: "" },
    status: { type: String, enum: ["open", "accepted", "rejected"], default: "open" },
    reply: { type: String, default: "" },
    decidedBy: { type: mongoose.SchemaTypes.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
appealSchema.index({ userId: 1, status: 1 });
appealSchema.plugin(toJSON);
appealSchema.plugin(paginate);
module.exports = mongoose.model("Appeal", appealSchema);
