// Browser (Web Push) notifications. Needs VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY
// (generate with `npx web-push generate-vapid-keys`). Without them push is
// off and every would-be push is only logged ("demo mode").
const { PushSubscription } = require("../models");
const wp = require("../utils/webpush");
const prefs = require("./notificationPrefs.service");
const logger = require("../config/logger");

// p256dh must be an uncompressed P-256 point, auth a 16-byte secret.
function validKeys({ p256dh, auth }) {
  try {
    const pub = Buffer.from(p256dh, "base64url");
    if (pub.length !== 65 || pub[0] !== 4 || Buffer.from(auth, "base64url").length !== 16) return false;
    const e = require("crypto").createECDH("prime256v1");
    e.generateKeys();
    e.computeSecret(pub); // throws for a point that is not on the curve
    return true;
  } catch {
    return false;
  }
}

const isEnabled = () => !!wp.vapid();
const config = () => ({ enabled: isEnabled(), publicKey: wp.vapid()?.publicKey || null });

async function subscribe(userId, sub, userAgent = "") {
  const endpoint = String(sub?.endpoint || "");
  const keys = { p256dh: String(sub?.keys?.p256dh || ""), auth: String(sub?.keys?.auth || "") };
  if (!wp.endpointAllowed(endpoint)) return { error: "This push service is not supported" };
  if (!validKeys(keys)) return { error: "Invalid subscription keys" };
  if ((await PushSubscription.countDocuments({ userId })) >= 10) {
    const oldest = await PushSubscription.find({ userId }).sort({ updatedAt: 1 }).limit(1);
    if (oldest[0]) await PushSubscription.deleteOne({ _id: oldest[0]._id });
  }
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { $set: { userId, keys, userAgent: String(userAgent).slice(0, 300), failures: 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { ok: true };
}

const unsubscribe = (userId, endpoint) => PushSubscription.deleteOne({ userId, endpoint: String(endpoint || "") });
const count = (userId) => PushSubscription.countDocuments({ userId });

/** Push to every browser of a user, honouring their preferences. Never throws. */
async function notifyUser(userId, category, { title, body, url = "/notifications", tag } = {}) {
  try {
    if (!userId) return 0;
    if (category && !(await prefs.allows({ userId }, "push", category))) return 0;
    const subs = await PushSubscription.find({ userId }).lean();
    if (!subs.length) return 0;
    const payload = { title: String(title || "Qwlee").slice(0, 120), body: String(body || "").slice(0, 300), url, tag };
    if (!isEnabled()) {
      logger.info(`[push:demo] ${subs.length} browser(s) of ${userId}: ${payload.title} — ${payload.body}`);
      return 0;
    }
    let sent = 0;
    for (const s of subs) {
      const r = await wp.send(s, payload);
      if (r.ok) {
        sent++;
        await PushSubscription.updateOne({ _id: s._id }, { $set: { lastSentAt: new Date(), failures: 0 } });
      } else if (r.gone || s.failures >= 4) {
        logger.info(`push subscription removed (${r.reason})`);
        await PushSubscription.deleteOne({ _id: s._id });
      } else {
        await PushSubscription.updateOne({ _id: s._id }, { $inc: { failures: 1 } });
        logger.warn(`push failed (${r.reason})`);
      }
    }
    return sent;
  } catch (e) {
    logger.warn(`push error: ${e.message}`);
    return 0;
  }
}

module.exports = { isEnabled, config, subscribe, unsubscribe, count, notifyUser };
