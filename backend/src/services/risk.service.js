// Keyword filters and risk flags.
//
// Admin → Settings → Moderation holds two word lists:
//   blockedWords: text containing one is refused (HTTP 400)
//   flaggedWords: text is accepted but a RiskFlag is opened for review
// Words match whole words, case-insensitive; a phrase may contain spaces.
// With flagContactInfo on, emails, phones, messengers, social handles,
// payment details, external payment links and obfuscated contact forms
// ("gmail dot com", "zero one seven…") open a flag. Messages are never
// blocked by default — mask/block are admin settings (default off).
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const logger = { warn: (m) => require("../config/logger").warn(m) };
const { RiskFlag, Payment, User, Notification } = require("../models");
const siteSettings = require("./siteSettings.service");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (w) => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(w).replace(/\s+/g, "\\s+")}(?=$|[^\\p{L}\\p{N}])`, "iu");

const DIGIT_WORDS = {
  zero: "0", oh: "0", o: "0",
  one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};

function deobfuscate(text) {
  let s = String(text || "");
  // "gmail dot com" / "at gmail" style
  // Only rewrite standalone "dot" / "at" tokens (not letters inside words
  // like "recommendation" → "recommend@ion").
  s = s.replace(/(^|[^\p{L}\p{N}])\[?\s*dot\s*\]?(?=$|[^\p{L}\p{N}])/giu, "$1.");
  s = s.replace(/(^|[^\p{L}\p{N}])\[?\s*at\s*\]?(?=$|[^\p{L}\p{N}])/giu, "$1@");
  s = s.replace(/\(\s*\.\s*\)/g, ".");
  // spaced letters in emails: "j o h n @ g m a i l . c o m"
  s = s.replace(/\b([a-z0-9])(?:\s+[a-z0-9]){2,}@(?:\s*[a-z0-9.])+/gi, (m) => m.replace(/\s+/g, ""));
  // digit words: "zero one seven one two three four five six seven"
  s = s.replace(
    /\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)(?:[\s\-]+(?:zero|oh|o|one|two|three|four|five|six|seven|eight|nine)){6,}\b/gi,
    (m) => m.toLowerCase().split(/[\s\-]+/).map((w) => DIGIT_WORDS[w] || "").join("")
  );
  return s;
}

const CONTACT = [
  ["contact:email", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ["contact:phone", /(?<![\w])(?:\+?\d[\s().-]?){9,}\d(?![\w])/],
  ["contact:messenger", /\b(whats\s?app|telegram|t\.me\/|wa\.me\/|skype|signal\s+me|discord\.gg|viber|wechat|line\s+id)\b/i],
  ["contact:social", /\b(instagram|insta(?:gram)?|ig\s*:|facebook|fb\.me\/|fb\.com\/|twitter|x\.com\/[\w]+|tiktok\.com\/|linkedin\.com\/in\/|snapchat|@[a-z][\w.]{2,30})\b/i],
  ["contact:payment", /\b(paypal\.me|pay\s*pal\.me|venmo|cash\s*app|zelle|wise\.com|payoneer|bank\s*transfer|iban|routing\s*number|swift\s*code|wire\s*transfer)\b/i],
  ["contact:card", /(?<!\+)\b(?:\d[ -]*?){15,19}\b/],
  ["contact:offplatform", /\b(let'?s\s+(move|talk|chat|continue)\s+(off|outside)|(?:leave|quit|bypass|avoid)\s+(the\s+)?(platform|qwlee|site)|off[\s-]?platform|outside\s+(of\s+)?(the\s+)?(platform|qwlee|site)|email\s+me\s+(at|directly)|call\s+me\s+(on|at)|text\s+me|dm\s+me\s+on)\b/i],
  ["contact:obfuscated-email", /\b[\w.+-]+\s*(?:\[|\(|\s)?(?:at|@)(?:\]|\)|\s)?\s*[\w-]+\s*(?:\[|\(|\s)?(?:dot|\.)(?:\]|\)|\s)?\s*(?:com|net|org|io|co)\b/i],
  ["contact:obfuscated-phone", /\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)(?:[\s\-]+(?:zero|oh|o|one|two|three|four|five|six|seven|eight|nine)){6,}\b/i],
];
// Off-platform payment asks (rules first; LLM second-pass explains)
const PAY_OFF = [
  ["pay-outside", /\b(pay\s+(me\s+)?outside|outside\s+(the\s+)?platform|off[- ]?platform\s+pay)\b/i],
  ["pay-outside", /\b(venmo|cash\s?app|paypal\.me|wire\s+transfer|gift\s*card)\b/i],
];

const MASK = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /(?<![\w/-])(?:\+?\d[\s().-]?){9,}\d(?![\w])/g,
  /\b(?:t\.me|wa\.me|discord\.gg|paypal\.me)\/\S+/gi,
];

function maskContact(text) {
  let s = String(text || "");
  for (const re of MASK) s = s.replace(re, "[contact details hidden]");
  return s;
}

function findSpans(text, reasons) {
  const spans = [];
  const src = String(text || "");
  const check = deobfuscate(src);
  for (const [reason, re] of CONTACT) {
    if (!reasons.includes(reason)) continue;
    const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m;
    const hay = /obfuscated/.test(reason) ? src : check;
    while ((m = r.exec(hay))) {
      spans.push({ start: m.index, end: m.index + m[0].length, reason, text: m[0].slice(0, 80) });
      if (m.index === r.lastIndex) r.lastIndex += 1;
    }
  }
  return spans.slice(0, 20);
}

function detectContact(text) {
  const raw = String(text || "");
  const normalized = deobfuscate(raw);
  const reasons = [];
  for (const [r, re] of CONTACT) {
    if (re.test(raw) || re.test(normalized)) reasons.push(r);
  }
  return [...new Set(reasons)];
}

/** True when the two users have at least one order together. */
async function haveOrder(a, b) {
  return !!(await Payment.exists({ $or: [{ clientId: a, freelancerId: b }, { clientId: b, freelancerId: a }] }));
}

async function rules() {
  return (await siteSettings.get()).moderation;
}

// Returns { reasons, spans, score } or throws when a blocked word is present.
async function screen(text, { contact = false } = {}) {
  const s = String(text || "");
  if (!s.trim()) return { reasons: [], spans: [], score: 0 };
  const m = await rules();
  const hit = m.blockedWords.find((w) => wordRe(w).test(s));
  if (hit) throw new ApiError(httpStatus.BAD_REQUEST, "This text contains a word that isn't allowed on this site. Please edit it and try again.");
  const reasons = m.flaggedWords.filter((w) => wordRe(w).test(s)).map((w) => `keyword:${w}`);
  if (contact && m.flagContactInfo !== false) reasons.push(...detectContact(s));
  // Legacy pay-outside tags from main (in addition to contact:payment / offplatform).
  try {
    for (const [r, re] of PAY_OFF) if (re.test(s)) reasons.push(r);
  } catch (_) { /* PAY_OFF may be absent in older deploys */ }
  const uniq = [...new Set(reasons)];
  return { reasons: uniq, spans: findSpans(s, uniq), score: uniq.length };

}

async function record(kind, targetId, userId, reasons, excerpt = "", extra = {}) {
  if (!reasons?.length) return null;
  try {
    const flag = await RiskFlag.create({
      kind,
      targetId: String(targetId),
      userId: userId || null,
      reasons: [...new Set(reasons)],
      score: extra.score || reasons.length,
      excerpt: String(excerpt || "").slice(0, 300),
      spans: extra.spans || [],
      chatId: extra.chatId || null,
      aiSource: extra.aiSource || "",
      status: "open",
    });
    // Fire-and-forget admin notify (never fail the user send).
    notifyAdmins(flag).catch((e) => logger.warn(`risk notify failed: ${e.message}`));
    // Fire-and-forget fraud AI second pass — never auto-bans; status stays open.
    setImmediate(() => {
      enrichFraudAi(flag).catch((e) => logger.warn(`fraud AI skipped: ${e.message}`));
    });

    return flag;
  } catch (e) {
    logger.warn(`risk flag not saved: ${e.message}`);
    return null;
  }
}

async function notifyAdmins(flag) {
  const reasonLabel = (flag.reasons || [])
    .map((r) =>
      r.startsWith("keyword:") ? `word “${r.slice(8)}”` :
      ({
        "contact:email": "email",
        "contact:phone": "phone",
        "contact:messenger": "messenger",
        "contact:social": "social handle",
        "contact:payment": "payment details",
        "contact:card": "card number",
        "contact:offplatform": "off-platform ask",
        "contact:obfuscated-email": "obfuscated email",
        "contact:obfuscated-phone": "obfuscated phone",
      })[r] || r
    )
    .join(", ");
  const message = `Flagged ${flag.kind}: ${reasonLabel || "risk"}${flag.excerpt ? ` — “${String(flag.excerpt).slice(0, 80)}”` : ""}`;
  const linkId = flag.chatId ? String(flag.chatId) : String(flag.targetId);
  const notif = await Notification.create({
    role: "admin",
    type: "message",
    linkId,
    message,
    viewStatus: false,
  });

  // Live push to every connected admin (admins room) + legacy event name.
  // Never load socketServer from seed/one-off scripts — it binds :8181.
  try {
    const isSeed = process.argv.some((a) => String(a).includes("seeders")) || process.env.SKIP_SOCKET === "1";
    if (isSeed) return;
    const resolved = require.resolve("../socket/socketServer");
    const cached = require.cache[resolved];
    const io = cached ? cached.exports.io : require("../socket/socketServer").io;
    if (!io) return;
    const payload = {
      message: "Risk flag",
      status: "OK",
      statusCode: 200,
      data: {
        flag: {
          id: String(flag._id),
          kind: flag.kind,
          reasons: flag.reasons,
          excerpt: flag.excerpt,
          score: flag.score,
          chatId: flag.chatId ? String(flag.chatId) : null,
          targetId: flag.targetId,
          createdAt: flag.createdAt,
        },
        notification: {
          id: String(notif._id),
          message,
          linkId,
          type: "message",
          viewStatus: false,
          createdAt: notif.createdAt,
        },
      },
    };
    io.to("admins").emit("admin-risk-flag", payload);
    io.emit("admin-notification::admin", payload);
  } catch (e) {
    logger.warn(`risk socket emit failed: ${e.message}`);
  }

  // Optional email to super admins (Mailpit in demo).
  try {
    const mod = await rules();
    if (mod.emailAdminsOnFlag) {
      const email = require("./email.service");
      const supers = await User.find({
        role: "admin",
        isBan: { $ne: true },
        $or: [{ adminRole: "super" }, { adminRole: null }, { adminRole: { $exists: false } }],
      })
        .select("email fullName")
        .lean();
      for (const a of supers) {
        if (!a.email) continue;
        await email.sendEmail(
          a.email,
          `[Qwlee] Flagged ${flag.kind}`,
          `<p>Hi ${a.fullName || "admin"},</p><p>${message}</p><p><a href="/admin/dashboard/conversations?tab=flagged">Open Flagged queue</a></p>`
        );
      }
    }
  } catch (e) {
    logger.warn(`risk admin email failed: ${e.message}`);
  }
}

async function enrichFraudAi(flag) {
  const fraudAi = require("./fraudAi/review");
  const patch = await fraudAi.reviewFlag(flag);
  if (!patch) return null;
  return RiskFlag.findByIdAndUpdate(flag._id, { $set: patch }, { new: true });
}

/** Re-run AI review on an existing open flag (admin). Status unchanged. */
async function aiReview(id, { mock = false } = {}) {
  const f = await RiskFlag.findById(id);
  if (!f) throw new ApiError(httpStatus.NOT_FOUND, "Flag not found");
  const fraudAi = require("./fraudAi/review");
  const patch = await fraudAi.reviewFlag(f, { forceMock: mock });
  if (!patch) throw new ApiError(httpStatus.BAD_GATEWAY, "AI fraud review unavailable");
  Object.assign(f, patch);
  await f.save();
  return f;
}

// Screen several fields at once (e.g. a gig's title and description).
async function screenAll(parts, opts) {
  const reasons = [];
  const spans = [];
  for (const p of parts) {
    if (!p) continue;
    const r = await screen(p, opts);
    reasons.push(...r.reasons);
    spans.push(...(r.spans || []));
  }
  const uniq = [...new Set(reasons)];
  return { reasons: uniq, spans, score: uniq.length };
}

// Optional AI enrichment via the FastAPI sidecar (mock when no API key).
async function enrichWithAi(text, base) {
  try {
    const url = (process.env.AI_DISPUTE_URL || "").replace(/\/+$/, "");
    if (!url) return base;
    const mock = !(process.env.AI_API_KEY && process.env.AI_API_URL);
    const r = await fetch(`${url}/v1/moderate-message`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Internal-Token": process.env.AI_DISPUTE_TOKEN || "",
      },
      body: JSON.stringify({ text: maskContact(String(text || "")).slice(0, 2000), heuristic: base, mock }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ...base, aiSource: "error" };
    const j = await r.json();
    const extra = Array.isArray(j?.reasons) ? j.reasons.filter(Boolean) : [];
    const reasons = [...new Set([...(base.reasons || []), ...extra])];
    return {
      reasons,
      spans: base.spans || [],
      score: Math.max(base.score || 0, Number(j.score) || reasons.length),
      aiSource: j.source || (mock ? "mock" : "remote"),
      aiSummary: j.summary || "",
    };
  } catch {
    return { ...base, aiSource: "fallback" };
  }
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
  return RiskFlag.paginate(filter, {
    sortBy: "createdAt:desc",
    page: Number(page) || 1,
    limit: Math.min(Number(limit) || 50, 200),
    populate: "userId reportedBy",
  });
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

module.exports = {
  maskContact,
  deobfuscate,
  detectContact,
  findSpans,
  haveOrder,
  screen,
  screenAll,
  enrichWithAi,
  enrichFraudAi,
  aiReview,
  record,
  notifyAdmins,
  orderPlaced,
  list,
  review,
  wordRe,
  CONTACT,
};
