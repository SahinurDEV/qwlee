// Team accounts (business workspaces).
//   - Any signed-in user can create a team and becomes its owner.
//   - Owners/admins invite people by email (MAX_MEMBERS 50). An invite to an
//     existing account shows up for that user; one to a new email is claimed
//     when someone signs up with it and opens Teams.
//   - Active members see every member's orders in one place (team orders),
//     which is the main point for companies with several buyers.
//   - Owners can promote/demote admins and remove anyone; members can leave.
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const Team = require("../models/team.model");
const User = require("../models/user.model");
const Notification = require("../models/notification.model");

const MAX_MEMBERS = 50;
const idOf = (v) => String(v?._id || v || "");
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;

async function getDoc(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(httpStatus.NOT_FOUND, "Team not found");
  const t = await Team.findById(id);
  if (!t) throw new ApiError(httpStatus.NOT_FOUND, "Team not found");
  return t;
}
const memberOf = (t, user) => t.members.find((m) => m.status === "active" && idOf(m.userId) === String(user.id));
function need(t, user, roles) {
  const m = memberOf(t, user);
  if (!m || !roles.includes(m.role)) throw new ApiError(httpStatus.FORBIDDEN, "You don't have access to this team");
  return m;
}

async function create(user, { name }) {
  const n = String(name || "").replace(/<[^>]*>/g, "").trim();
  if (n.length < 2) throw new ApiError(httpStatus.BAD_REQUEST, "Team name needs 2+ characters");
  if ((await Team.countDocuments({ ownerId: user.id })) >= 5) throw new ApiError(httpStatus.BAD_REQUEST, "You can own at most 5 teams");
  const me = await User.findById(user.id, "email");
  return Team.create({ name: n.slice(0, 80), ownerId: user.id, members: [{ userId: user.id, email: me.email, role: "owner", status: "active" }] });
}

// Teams I'm in plus invites waiting for me (claims invites by email).
async function mine(user) {
  const me = await User.findById(user.id, "email").lean();
  await Team.updateMany({ members: { $elemMatch: { email: me.email, userId: null } } }, { $set: { "members.$[m].userId": user.id } }, { arrayFilters: [{ "m.email": me.email, "m.userId": null }] });
  const teams = await Team.find({ "members.userId": user.id }).populate({ path: "members.userId", select: "fullName username image" });
  return {
    teams: teams.filter((t) => memberOf(t, user)).map((t) => ({ ...t.toJSON(), myRole: memberOf(t, user).role })),
    invites: teams.filter((t) => !memberOf(t, user)).map((t) => ({ id: String(t._id), name: t.name })),
  };
}

async function invite(id, user, { email, role = "member" }) {
  const t = await getDoc(id);
  const me = need(t, user, ["owner", "admin"]);
  const e = String(email || "").trim().toLowerCase();
  if (!emailOk(e)) throw new ApiError(httpStatus.BAD_REQUEST, "Enter a valid email");
  if (!["admin", "member"].includes(role)) throw new ApiError(httpStatus.BAD_REQUEST, "role must be admin or member");
  if (role === "admin" && me.role !== "owner") throw new ApiError(httpStatus.FORBIDDEN, "Only the owner can add admins");
  if (t.members.some((m) => m.email === e)) throw new ApiError(httpStatus.CONFLICT, "Already invited");
  if (t.members.length >= MAX_MEMBERS) throw new ApiError(httpStatus.BAD_REQUEST, `Teams can have at most ${MAX_MEMBERS} people`);
  const u = await User.findOne({ email: e }, "_id").lean();
  t.members.push({ email: e, userId: u?._id || null, role, status: "invited", invitedBy: user.id });
  await t.save();
  if (u) Notification.create({ receiverId: u._id, role: "buyer", message: `You've been invited to the team "${t.name}"`, linkId: String(t._id) }).catch(() => null);
  return t;
}

async function respond(id, user, accept) {
  const t = await getDoc(id);
  const m = t.members.find((x) => idOf(x.userId) === String(user.id) && x.status === "invited");
  if (!m) throw new ApiError(httpStatus.NOT_FOUND, "No invite for you");
  if (accept) m.status = "active";
  else m.deleteOne();
  await t.save();
  return t;
}

async function setRole(id, user, memberId, role) {
  const t = await getDoc(id);
  need(t, user, ["owner"]);
  const m = t.members.id(memberId);
  if (!m || m.role === "owner") throw new ApiError(httpStatus.BAD_REQUEST, "Can't change that member");
  if (!["admin", "member"].includes(role)) throw new ApiError(httpStatus.BAD_REQUEST, "role must be admin or member");
  m.role = role;
  await t.save();
  return t;
}

async function remove(id, user, memberId) {
  const t = await getDoc(id);
  const me = memberOf(t, user);
  const m = t.members.id(memberId);
  if (!me || !m) throw new ApiError(httpStatus.NOT_FOUND, "Member not found");
  const self = idOf(m.userId) === String(user.id);
  if (m.role === "owner") throw new ApiError(httpStatus.BAD_REQUEST, "The owner can't be removed");
  if (!self && !(me.role === "owner" || (me.role === "admin" && m.role === "member"))) throw new ApiError(httpStatus.FORBIDDEN, "You can't remove this member");
  m.deleteOne();
  await t.save();
  return t;
}

async function orders(id, user, { status, limit = 50 } = {}) {
  const t = await getDoc(id);
  need(t, user, ["owner", "admin", "member"]);
  const ids = t.members.filter((m) => m.status === "active" && m.userId).map((m) => m.userId);
  const q = { clientId: { $in: ids }, isDeleted: { $ne: true } };
  if (status) q.status = String(status);
  const Payment = mongoose.model("Payment");
  const rows = await Payment.find(q, "status price items gigId clientId freelancerId createdAt deliveryDate").sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 50, 200))
    .populate([{ path: "clientId", select: "fullName username" }, { path: "freelancerId", select: "fullName username" }, { path: "gigId", select: "title slug" }]).lean();
  const spent = rows.filter((o) => o.status === "delivered").reduce((n, o) => n + Number(o.price || o.items?.[0]?.price || 0), 0);
  return { results: rows, summary: { orders: rows.length, open: rows.filter((o) => ["active", "late", "delivered"].includes(o.status) && o.status !== "delivered").length, spent: Math.round(spent * 100) / 100 } };
}

module.exports = { create, mine, invite, respond, setRole, remove, orders };
