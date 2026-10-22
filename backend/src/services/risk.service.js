// Keyword filters and risk flags.
//
// Admin → Settings → Moderation holds two word lists:
//   blockedWords: text containing one is refused (HTTP 400)
//   flaggedWords: text is accepted but a RiskFlag is opened for review
// Words match whole words, case-insensitive; a phrase may contain spaces.
// With flagContactInfo on, emails, phone numbers and links to off-platform
// messengers in messages/offers/requests also open a flag (taking work off
// the platform). Orders open a flag when a new account (< 3 days) places a
// large one (riskOrderAmount) or places 3+ orders within an hour.
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const logger = { warn: (m) => require("../config/logger").warn(m) };
const { RiskFlag, Payment, User } = require("../models");
const siteSettings = require("./siteSettings.service");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (w) => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(w).replace(/\s+/g, "\\s+")}(?=$|[^\\p{L}\\p{N}])`, "iu");

const CONTACT = [
  ["contact:email", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ["contact:phone", /(?<![\w])(?:\+?\d[\s().-]?){9,}\d(?![\w])/],
  ["contact:messenger", /\b(whats\s?app|telegram|t\.me\/|wa\.me\/|skype|signal\s+me|discord\.gg)\b/i],
];

async function rules() {
  const m = (await siteSettings.get()).moderation;
  return m;
}

// Returns { reasons } or throws when a blocked word is present.
async function screen(text, { contact = false } = {}) {
  const s = String(text || "");
  if (!s.trim()) return { reasons: [] };
  const m = await rules();
  const hit = m.blockedWords.find((w) => wordRe(w).test(s));
  if (hit) throw new ApiError(httpStatus.BAD_REQUEST, "This text contains a word that isn't allowed on this site. Please edit it and try again.");
  const reasons = m.flaggedWords.filter((w) => wordRe(w).test(s)).map((w) => `keyword:${w}`);
  if (contact && m.flagContactInfo) for (const [r, re] of CONTACT) if (re.test(s)) reasons.push(r);
  return { reasons };
}

async function record(kind, targetId, userId, reasons, excerpt = "") {
  if (!reasons?.length) return null;
  try {
    return await RiskFlag.create({ kind, targetId: String(targetId), userId: userId || null, reasons: [...new Set(reasons)], score: reasons.length, excerpt: String(excerpt || "").slice(0, 300) });
  } catch (e) {
    logger.warn(`risk flag not saved: ${e.message}`);
    return null;
  }
}

// Screen several fields at once (e.g. a gig's title and description).
async function screenAll(parts, opts) {
  const reasons = [];
  for (const p of parts) reasons.push(...(await screen(p, opts)).reasons);
  return { reasons: [...new Set(reasons)] };
}

async function orderPlaced(order) {
  try {
    const m = await rules();
    const buyer = await User.findById(order.clientId).select("createdAt").lean();
    const reasons = [];
    const ageDays = buyer ? (Date.now() - new Date(buyer.createdAt).getTime()) / 86400000 : 0;
    const price = Number(order.price || 0);
    if (ageDays < 3 && m.riskOrderAmount > 0 && price >= m.riskOrderAmount) reasons.push("new-account-large-order");
    const recent = await Payment.countDocuments({ clientId: order.clientId, createdAt: { $gte: new Date(Date.now() - 3600000) } });
    if (recent >= 3) reasons.push("order-burst");
    if (reasons.length) {
      const already = await RiskFlag.exists({ kind: "order", targetId: String(order._id) });
      if (!already) await record("order", order._id, order.clientId, reasons, `$${price} order`);
    }
  } catch (e) {
    logger.warn(`order risk check failed: ${e.message}`);
  }
}

async function list({ status = "open", kind, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (status && status !== "all") filter.status = status;
  if (kind) filter.kind = kind;
  return RiskFlag.paginate(filter, { sortBy: "createdAt:desc", page: Number(page) || 1, limit: Math.min(Number(limit) || 50, 200), populate: "userId" });
}

async function review(id, { status, note }, reviewer) {
  if (!["open", "dismissed", "actioned"].includes(status)) throw new ApiError(httpStatus.BAD_REQUEST, "status must be open, dismissed or actioned");
  const f = await RiskFlag.findByIdAndUpdate(
    id,
    { $set: { status, note: String(note || "").slice(0, 500), reviewedBy: status === "open" ? null : reviewer._id, reviewedAt: status === "open" ? null : new Date() } },
    { new: true }
  );
  if (!f) throw new ApiError(httpStatus.NOT_FOUND, "Flag not found");
  return f;
}

module.exports = { screen, screenAll, record, orderPlaced, list, review, wordRe, CONTACT };
