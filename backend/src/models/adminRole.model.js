const mongoose = require("mongoose");
const { toJSON } = require("./plugins");

// Custom admin role made by a super admin (adminRoles.service). Built-in
// roles live in config/adminPermissions.js and can't be changed.
const adminRoleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    permissions: [{ type: String }],
  },
  { timestamps: true }
);
adminRoleSchema.plugin(toJSON);
module.exports = mongoose.model("AdminRole", adminRoleSchema);
