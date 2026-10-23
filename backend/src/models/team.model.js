// Business workspace / team account: a group of buyers who share an order
// view (Fiverr Business / Upwork Teams-style).
const mongoose = require("mongoose");
const { toJSON } = require("./plugins");

const memberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
    status: { type: String, enum: ["invited", "active"], default: "invited" },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true }
);
teamSchema.index({ "members.userId": 1 });
teamSchema.index({ "members.email": 1 });
teamSchema.plugin(toJSON);

module.exports = mongoose.model("Team", teamSchema);
