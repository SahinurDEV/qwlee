const crypto = require("crypto");
const { Session } = require("../models");

const clientIp = (req) =>
  String((req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || req?.ip || "").slice(0, 64);

async function create(userId, expires, req) {
  const sid = crypto.randomBytes(16).toString("hex");
  await Session.create({
    sid,
    user: userId,
    userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 300),
    ip: clientIp(req),
    expiresAt: expires,
  });
  return sid;
}

// Small cache so the per-request check is cheap; a revoke clears it.
const cache = new Map();
const TTL = 15 * 1000;
async function isActive(sid) {
  const hit = cache.get(sid);
  if (hit && hit.at > Date.now() - TTL) return hit.ok;
  const s = await Session.findOne({ sid }, { revokedAt: 1, expiresAt: 1 }).lean();
  const ok = !!s && !s.revokedAt && new Date(s.expiresAt) > new Date();
  cache.set(sid, { ok, at: Date.now() });
  if (cache.size > 10000) cache.clear();
  if (ok && s) Session.updateOne({ sid, lastSeenAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
  return ok;
}

async function list(userId) {
  return Session.find({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }).lean();
}

async function revoke(userId, sid, by) {
  const r = await Session.updateOne({ user: userId, sid, revokedAt: null }, { $set: { revokedAt: new Date(), revokedBy: by || userId } });
  cache.delete(sid);
  // Its refresh tokens are useless now too.
  await require("../models").Token.deleteMany({ user: userId, sid });
  return r.modifiedCount > 0;
}

async function revokeOthers(userId, keepSid) {
  const rows = await Session.find({ user: userId, revokedAt: null, sid: { $ne: keepSid } }, { sid: 1 }).lean();
  for (const r of rows) await revoke(userId, r.sid, userId);
  return rows.length;
}

const view = (s, currentSid) => ({
  id: s.sid,
  userAgent: s.userAgent,
  ip: s.ip,
  createdAt: s.createdAt,
  lastSeenAt: s.lastSeenAt,
  current: s.sid === currentSid,
});

module.exports = { create, isActive, list, revoke, revokeOthers, view, clientIp };
