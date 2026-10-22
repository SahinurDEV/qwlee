// Admin announcements: targeting, scheduling and sending.
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const logger = { warn: (m) => require("../config/logger").warn(m) };
const { Announcement, User, Notification, Payment } = require("../models");

const num = (v, max) => {
  const n = Math.round(Number(v || 0));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};

function cleanTarget(t = {}) {
  return {
    location: String(t.location || "").trim().slice(0, 60),
    joinedWithinDays: num(t.joinedWithinDays, 3650),
    activeWithinDays: num(t.activeWithinDays, 3650),
    verifiedOnly: t.verifiedOnly === true || t.verifiedOnly === "true",
    hasOrdered: ["yes", "no"].includes(t.hasOrdered) ? t.hasOrdered : "any",
  };
}

function clean(body = {}) {
  const title = String(body.title || "").trim().slice(0, 120);
  const message = String(body.message || "").trim().slice(0, 2000);
  const audience = ["all", "buyers", "sellers"].includes(body.audience) ? body.audience : "all";
  const link = String(body.link || "").trim().slice(0, 300);
  if (!title || !message) throw new ApiError(httpStatus.BAD_REQUEST, "Title and message are required");
  if (link && !/^(https?:\/\/|\/)/.test(link)) throw new ApiError(httpStatus.BAD_REQUEST, "Link must be a URL or a /path");
  let sendAt = null;
  if (body.sendAt) {
    sendAt = new Date(body.sendAt);
    if (Number.isNaN(sendAt.getTime())) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid send time");
    if (sendAt <= new Date(Date.now() + 30000)) sendAt = null; // now-ish: send straight away
    else if (sendAt > new Date(Date.now() + 366 * 86400000)) throw new ApiError(httpStatus.BAD_REQUEST, "Schedule at most a year ahead");
  }
  return { title, message, audience, link, sendEmail: body.sendEmail === true || body.sendEmail === "true", target: cleanTarget(body.target), sendAt };
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function userFilter(audience, target) {
  const f = { isBan: { $ne: true }, isDeleted: { $ne: true } };
  f.role = audience === "buyers" ? "buyer" : audience === "sellers" ? "freelancer" : { $in: ["buyer", "freelancer"] };
  if (target.location) f.location = { $regex: escRe(target.location), $options: "i" };
  if (target.joinedWithinDays) f.createdAt = { $gte: new Date(Date.now() - target.joinedWithinDays * 86400000) };
  if (target.activeWithinDays) f.lastSeen = { $gte: new Date(Date.now() - target.activeWithinDays * 86400000) };
  if (target.verifiedOnly) f.isVerified = true;
  if (target.hasOrdered !== "any") {
    const buyers = await Payment.distinct("clientId");
    f._id = target.hasOrdered === "yes" ? { $in: buyers } : { $nin: buyers };
  }
  return f;
}

async function preview(body = {}) {
  const audience = ["all", "buyers", "sellers"].includes(body.audience) ? body.audience : "all";
  const target = cleanTarget(body.target);
  const f = await userFilter(audience, target);
  const [count, sample] = await Promise.all([User.countDocuments(f), User.find(f).select("fullName email").limit(5).lean()]);
  return { count, sample: sample.map((u) => u.fullName || u.email) };
}

async function deliver(doc) {
  const users = await User.find(await userFilter(doc.audience, doc.target || {})).select("_id email fullName role").lean();
  const { title, message, link } = doc;
  await Notification.insertMany(users.map((u) => ({ receiverId: u._id, role: u.role, type: "announcement", message: `${title}: ${message}`.slice(0, 2000), linkId: link })));
  try {
    const { io } = require("../socket/socketServer");
    for (const u of users) io.emit(`${u.role === "buyer" ? "buyer" : "freelancer"}-notification::${u._id}`, { message: "Announcement", data: { title, message, link } });
  } catch {
    /* socket optional */
  }
  let emailed = 0;
  if (doc.sendEmail) {
    const e = require("./email.service");
    for (const u of users.slice(0, 2000)) if (u.email && (await e.sendAnnouncement(u.email, { recipientName: u.fullName, title, message, link }))) emailed++;
  }
  return { recipients: users.length, emailed };
}

async function create(body, adminId) {
  const data = clean(body);
  if (data.sendAt) return Announcement.create({ ...data, status: "scheduled", createdBy: adminId });
  const doc = await Announcement.create({ ...data, status: "sending", createdBy: adminId });
  const r = await deliver(doc);
  return Announcement.findByIdAndUpdate(doc._id, { $set: { ...r, status: "sent", sentAt: new Date() } }, { new: true });
}

async function update(id, body) {
  const cur = await Announcement.findById(id);
  if (!cur) throw new ApiError(httpStatus.NOT_FOUND, "Announcement not found");
  if (cur.status !== "scheduled") throw new ApiError(httpStatus.CONFLICT, "Only scheduled announcements can be changed");
  const data = clean({ ...cur.toObject(), ...body, target: { ...(cur.target?.toObject?.() || cur.target || {}), ...(body.target || {}) } });
  if (!data.sendAt) throw new ApiError(httpStatus.BAD_REQUEST, "A scheduled announcement needs a future send time");
  const r = await Announcement.findOneAndUpdate({ _id: id, status: "scheduled" }, { $set: data }, { new: true });
  if (!r) throw new ApiError(httpStatus.CONFLICT, "It is being sent already");
  return r;
}

async function cancel(id) {
  const r = await Announcement.findOneAndUpdate({ _id: id, status: "scheduled" }, { $set: { status: "cancelled" } }, { new: true });
  if (!r) throw new ApiError(httpStatus.CONFLICT, "Only scheduled announcements can be cancelled");
  return r;
}

// Housekeeping: send what's due. Each one is claimed first so two
// instances never send it twice.
async function sendDue(now = new Date()) {
  let sent = 0;
  for (;;) {
    const doc = await Announcement.findOneAndUpdate({ status: "scheduled", sendAt: { $lte: now } }, { $set: { status: "sending" } }, { new: true, sort: { sendAt: 1 } });
    if (!doc) break;
    try {
      const r = await deliver(doc);
      await Announcement.updateOne({ _id: doc._id }, { $set: { ...r, status: "sent", sentAt: new Date() } });
      sent++;
    } catch (e) {
      logger.warn(`announcement ${doc._id} failed: ${e.message}`);
      await Announcement.updateOne({ _id: doc._id }, { $set: { status: "failed", error: String(e.message).slice(0, 300) } });
    }
  }
  return sent;
}

module.exports = { preview, create, update, cancel, sendDue, clean };
