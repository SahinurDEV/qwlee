// Custom admin roles. Built-in roles (super, moderator, support, finance)
// are fixed; super admins add roles with any mix of the permissions in
// config/adminPermissions.js (never "*"). The permission check is sync, so
// the roles are cached in memory and reloaded every 30s and after changes.
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const perms = require("../config/adminPermissions");
const { AdminRole, User } = require("../models");

let loadedAt = 0;
let loading = null;

async function load() {
  const rows = await AdminRole.find().lean();
  perms.setCustomRoles(Object.fromEntries(rows.map((r) => [r.key, r.permissions || []])));
  loadedAt = Date.now();
  return rows;
}

async function ensureFresh() {
  if (Date.now() - loadedAt < 30000) return;
  if (!loading) loading = load().finally(() => (loading = null));
  try {
    await loading;
  } catch {
    /* keep the last known roles */
  }
}

function clean(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = String(body.name || "").trim().slice(0, 40);
    if (out.name.length < 2) throw new ApiError(httpStatus.BAD_REQUEST, "Name must be at least 2 characters");
  }
  if (body.description !== undefined) out.description = String(body.description || "").trim().slice(0, 200);
  if (!partial || body.permissions !== undefined) {
    const list = Array.isArray(body.permissions) ? [...new Set(body.permissions.map(String))] : [];
    const bad = list.filter((p) => !perms.PERMISSIONS.includes(p));
    if (bad.length) throw new ApiError(httpStatus.BAD_REQUEST, `Unknown permission: ${bad.join(", ")}`);
    if (!list.length) throw new ApiError(httpStatus.BAD_REQUEST, "Pick at least one permission");
    out.permissions = list.includes("read") ? list : ["read", ...list];
  }
  return out;
}

async function list() {
  const rows = await load();
  const counts = await User.aggregate([{ $match: { role: "admin" } }, { $group: { _id: "$adminRole", n: { $sum: 1 } } }]);
  const n = Object.fromEntries(counts.map((c) => [c._id || "super", c.n]));
  return {
    permissions: perms.PERMISSIONS,
    builtIn: Object.entries(perms.ROLE_PERMISSIONS).map(([key, p]) => ({ key, name: key, permissions: p, builtIn: true, admins: n[key] || 0 })),
    custom: rows.map((r) => ({ id: String(r._id), key: r.key, name: r.name, description: r.description, permissions: r.permissions, admins: n[r.key] || 0 })),
  };
}

async function create(body) {
  const key = String(body.key || body.name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
  if (key.length < 2) throw new ApiError(httpStatus.BAD_REQUEST, "Key must be at least 2 letters or digits");
  if (perms.ROLE_PERMISSIONS[key] || key === "none") throw new ApiError(httpStatus.BAD_REQUEST, "That key belongs to a built-in role");
  if (await AdminRole.exists({ key })) throw new ApiError(httpStatus.CONFLICT, "A role with that key already exists");
  const role = await AdminRole.create({ key, ...clean(body) });
  await load();
  return role;
}

async function update(id, body) {
  const role = await AdminRole.findByIdAndUpdate(id, { $set: clean(body, { partial: true }) }, { new: true });
  if (!role) throw new ApiError(httpStatus.NOT_FOUND, "Role not found");
  await load();
  // Holders sign in again so their sessions pick up the new rights.
  await User.updateMany({ role: "admin", adminRole: role.key }, { $set: { tokensValidAfter: new Date() } });
  return role;
}

async function remove(id) {
  const role = await AdminRole.findById(id);
  if (!role) throw new ApiError(httpStatus.NOT_FOUND, "Role not found");
  const holders = await User.countDocuments({ role: "admin", adminRole: role.key });
  if (holders) throw new ApiError(httpStatus.CONFLICT, `${holders} admin(s) still have this role; move them to another role first`);
  await role.deleteOne();
  await load();
  return { deleted: true };
}

module.exports = { load, ensureFresh, list, create, update, remove };
