// Which notifications a user wants, per channel. In-app notifications are
// always kept; email and browser push can be switched off per category.
// Security and money emails (sign-in codes, password reset, withdrawals,
// account actions) are always sent and are not listed here.
const { User } = require("../models");

const CATEGORIES = {
  orders: "Orders: new orders, deliveries, revisions, cancellations",
  messages: "Messages and custom offers",
  reviews: "Reviews and replies",
  requests: "Buyer requests and offers",
  payments: "Payments and payouts",
  marketing: "News and announcements from the site",
};
const CHANNELS = ["email", "push"];
// payments has no opt-out for email (receipts); it stays in the list for push.
const EMAIL_LOCKED = ["payments"];

function normalise(raw = {}) {
  const out = {};
  for (const ch of CHANNELS) {
    out[ch] = {};
    for (const c of Object.keys(CATEGORIES)) {
      const v = raw?.[ch]?.[c];
      out[ch][c] = ch === "email" && EMAIL_LOCKED.includes(c) ? true : v !== false;
    }
  }
  return out;
}

async function get(userId) {
  const u = await User.findById(userId).select("notificationPrefs").lean();
  return normalise(u?.notificationPrefs);
}

/** Merge a partial {email:{orders:false}, push:{...}} into the saved prefs. */
async function update(userId, patch = {}) {
  const cur = await get(userId);
  for (const ch of CHANNELS) {
    for (const c of Object.keys(CATEGORIES)) {
      if (typeof patch?.[ch]?.[c] === "boolean") cur[ch][c] = patch[ch][c];
    }
  }
  const next = normalise(cur);
  await User.updateOne({ _id: userId }, { $set: { notificationPrefs: next } });
  return next;
}

async function allows({ userId, email }, channel, category) {
  if (!CATEGORIES[category]) return true;
  const q = userId ? { _id: userId } : { email: String(email || "").toLowerCase() };
  const u = await User.findOne(q).select("notificationPrefs").lean().catch(() => null);
  if (!u) return true;
  return normalise(u.notificationPrefs)[channel][category];
}

// Notification.type -> category
const TYPE_CATEGORY = { order: "orders", message: "messages", payment: "payments", request: "requests", announcement: "marketing" };

module.exports = { CATEGORIES, CHANNELS, EMAIL_LOCKED, normalise, get, update, allows, TYPE_CATEGORY };
