// Admin-editable site settings stored in AppConfig.site. Each section is
// validated and clamped here; consumers call get() (cached with the
// AppConfig singleton) and never see raw admin input.
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const { AppConfig } = require("../models");
const appConfigService = require("./appConfig.service");

const str = (v, max) => String(v ?? "").trim().slice(0, max);
const bool = (v, d) => (v === undefined || v === null || v === "" ? d : v === true || v === "true");
const num = (v, d, min, max) => {
  if (v === undefined || v === null || v === "") return d;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new ApiError(httpStatus.BAD_REQUEST, `Value ${v} must be between ${min} and ${max}`);
  return n;
};
const url = (v) => {
  const s = str(v, 500);
  if (s && !/^https?:\/\//i.test(s) && !(s.startsWith("/") && !s.startsWith("//"))) throw new ApiError(httpStatus.BAD_REQUEST, `"${s}" must be an http(s) URL or a /path`);
  return s;
};
function loyaltyFees(v) {
  const d = { enabled: false, tiers: [{ over: 500, percent: 3 }, { over: 10000, percent: 1 }] };
  if (!v || typeof v !== "object") return d;
  const tiers = Array.isArray(v.tiers) ? v.tiers : d.tiers;
  if (tiers.length > 5) throw new ApiError(httpStatus.BAD_REQUEST, "At most 5 loyalty fee tiers");
  const out = tiers.map((t) => {
    const over = Number(t?.over);
    const percent = Number(t?.percent);
    if (!Number.isFinite(over) || over < 0 || over > 10000000) throw new ApiError(httpStatus.BAD_REQUEST, "Loyalty tier amount must be 0–10,000,000");
    if (!Number.isFinite(percent) || percent < 0 || percent > 50) throw new ApiError(httpStatus.BAD_REQUEST, "Loyalty fees must be 0–50%");
    return { over: Math.round(over * 100) / 100, percent: Math.round(percent * 100) / 100 };
  }).sort((a, b) => a.over - b.over);
  return { enabled: v.enabled === true || v.enabled === "true", tiers: out };
}

function categoryFees(v) {
  const seen = new Set();
  const out = [];
  for (const r of Array.isArray(v) ? v : []) {
    const id = String(r?.categoryId || "");
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new ApiError(httpStatus.BAD_REQUEST, "Pick a category for every fee rule");
    if (seen.has(id)) throw new ApiError(httpStatus.BAD_REQUEST, "Each category can only have one fee rule");
    seen.add(id);
    const p = Number(r.percent);
    if (!Number.isFinite(p) || p < 0 || p > 50) throw new ApiError(httpStatus.BAD_REQUEST, "Category fees must be 0–50%");
    out.push({ categoryId: id, percent: Math.round(p * 100) / 100 });
  }
  if (out.length > 200) throw new ApiError(httpStatus.BAD_REQUEST, "At most 200 category fee rules");
  return out;
}

// Homepage builder: the hero always comes first; these sections follow in
// the admin's order and can be hidden. Up to 5 custom text blocks
// ("block-1".."block-5") can be placed anywhere in the list.
const HOME_SECTIONS = ["stats", "recentlyViewed", "recommended", "categories", "howItWorks", "freelancers", "whyUs", "testimonials", "join", "blog"];
const BLOCK_IDS = ["block-1", "block-2", "block-3", "block-4", "block-5"];
function homeLayout(h) {
  const blocks = (Array.isArray(h.blocks) ? h.blocks : [])
    .filter((b) => b && BLOCK_IDS.includes(b.id))
    .map((b) => ({
      id: b.id,
      title: str(b.title, 120),
      text: str(b.text, 600),
      ctaLabel: str(b.ctaLabel, 40),
      ctaLink: url(b.ctaLink),
      tone: ["light", "brand", "dark"].includes(b.tone) ? b.tone : "light",
    }))
    .filter((b) => b.title || b.text);
  const known = [...HOME_SECTIONS, ...blocks.map((b) => b.id)];
  const seen = new Set();
  const sections = [];
  for (const x of Array.isArray(h.sections) ? h.sections : []) {
    const key = typeof x === "string" ? x : x?.key;
    if (!known.includes(key) || seen.has(key)) continue;
    seen.add(key);
    sections.push({ key, enabled: typeof x === "string" ? true : bool(x.enabled, true) });
  }
  for (const key of known) if (!seen.has(key)) sections.push({ key, enabled: true });
  return { sections, blocks };
}
const color = (v, d) => {
  const s = str(v, 7);
  if (!s) return d;
  if (!/^#[0-9a-f]{6}$/i.test(s)) throw new ApiError(httpStatus.BAD_REQUEST, "Colours must look like #10b981");
  return s;
};

function defaults() {
  return {
    marketplace: {
      feePercent: Number(process.env.PLATFORM_FEE_PERCENT ?? 5),
      autoCompleteDays: Number(process.env.AUTO_COMPLETE_DAYS) || 3,
      demoPayments: process.env.DEMO_PAYMENTS === "true",
      requireGigApproval: false,
      secondApprovalOver: Number(process.env.SECOND_APPROVAL_OVER || 0),
      categoryFees: [],
      loyaltyFees: { enabled: false, tiers: [{ over: 500, percent: 3 }, { over: 10000, percent: 1 }] },
    },
    branding: { siteName: process.env.SITE_NAME || "Qwlee", logoUrl: "", primaryColor: "#059669" },
    homepage: { heroTitle: "", heroSubtitle: "", announcement: { enabled: false, text: "", link: "", tone: "info" }, sections: [], blocks: [] },
    seo: { title: "", description: "", ogImage: "" },
    email: { footerText: "" },
    features: { signups: true, buyerRequests: true, tips: true, googleLogin: true },
    security: { requireAdmin2fa: false, adminIpAllowlist: [] },
    growth: { referrals: true, refereePercent: 10, referrerReward: 10 },
    moderation: { blockedWords: [], flaggedWords: [], flagContactInfo: true, riskOrderAmount: 500 },
    maintenance: { enabled: false, message: "", until: "" },
  };
}

// Merge stored values over defaults and normalise.
function normalise(site = {}, base = defaults()) {
  const m = { ...base.marketplace, ...(site.marketplace || {}) };
  const b = { ...base.branding, ...(site.branding || {}) };
  const h = { ...base.homepage, ...(site.homepage || {}) };
  const a = { ...base.homepage.announcement, ...(h.announcement || {}) };
  const s = { ...base.seo, ...(site.seo || {}) };
  const e = { ...base.email, ...(site.email || {}) };
  const f = { ...base.features, ...(site.features || {}) };
  const sec = { ...base.security, ...(site.security || {}) };
  const g = { ...base.growth, ...(site.growth || {}) };
  const mod = { ...base.moderation, ...(site.moderation || {}) };
  const mt = { ...base.maintenance, ...(site.maintenance || {}) };
  const until = str(mt.until, 40);
  if (until && Number.isNaN(Date.parse(until))) throw new ApiError(httpStatus.BAD_REQUEST, "Maintenance end time must be a date");
  const words = (v) => [...new Set((Array.isArray(v) ? v : String(v || "").split(/[\n,]+/)).map((x) => String(x).trim().toLowerCase().slice(0, 60)).filter(Boolean))].slice(0, 300);
  const ipList = (Array.isArray(sec.adminIpAllowlist) ? sec.adminIpAllowlist : String(sec.adminIpAllowlist || "").split(/[\s,]+/))
    .map((x) => String(x).trim())
    .filter((x) => require("../utils/ipMatch").validEntry(x))
    .slice(0, 50);
  return {
    marketplace: {
      feePercent: num(m.feePercent, 5, 0, 50),
      autoCompleteDays: Math.round(num(m.autoCompleteDays, 3, 1, 30)),
      demoPayments: bool(m.demoPayments, false),
      requireGigApproval: bool(m.requireGigApproval, false),
      // Refunds / payouts at or above this amount (USD) need a second
      // admin's approval. 0 = off.
      secondApprovalOver: num(m.secondApprovalOver, 0, 0, 1000000),
      // Per-category overrides of feePercent: [{ categoryId, percent }].
      // A sub-category rule beats its parent's; no rule = feePercent.
      categoryFees: categoryFees(m.categoryFees),
      // Loyalty fees: once a seller has earned more than `over` (USD,
      // completed orders) from the same client, later orders with that
      // client pay at most `percent`. Off by default.
      loyaltyFees: loyaltyFees(m.loyaltyFees),
    },
    branding: { siteName: str(b.siteName, 40) || "Qwlee", logoUrl: url(b.logoUrl), primaryColor: color(b.primaryColor, "#059669") },
    homepage: {
      heroTitle: str(h.heroTitle, 120),
      heroSubtitle: str(h.heroSubtitle, 240),
      announcement: {
        enabled: bool(a.enabled, false),
        text: str(a.text, 200),
        link: url(a.link),
        tone: ["info", "success", "warning"].includes(a.tone) ? a.tone : "info",
      },
      ...homeLayout(h),
    },
    seo: { title: str(s.title, 70), description: str(s.description, 170), ogImage: url(s.ogImage) },
    email: { footerText: str(e.footerText, 300) },
    features: Object.fromEntries(Object.keys(base.features).map((k) => [k, bool(f[k], true)])),
    security: { requireAdmin2fa: bool(sec.requireAdmin2fa, false), adminIpAllowlist: ipList },
    // Referral programme: the invitee gets refereePercent% off their first
    // order; the inviter gets a $referrerReward coupon when it completes.
    growth: { referrals: bool(g.referrals, true), refereePercent: num(g.refereePercent, 10, 0, 50), referrerReward: num(g.referrerReward, 10, 0, 500) },
    // Keyword filters and risk rules (risk.service).
    moderation: {
      blockedWords: words(mod.blockedWords),
      flaggedWords: words(mod.flaggedWords),
      flagContactInfo: bool(mod.flagContactInfo, true),
      riskOrderAmount: num(mod.riskOrderAmount, 500, 0, 1000000),
    },
    // Maintenance mode: the marketplace shows a maintenance page and the
    // API answers 503 for everyone but admins (see middlewares/maintenance).
    maintenance: { enabled: bool(mt.enabled, false), message: str(mt.message, 300), until: until ? new Date(until).toISOString() : "" },
  };
}

async function get() {
  const doc = await appConfigService.getConfig();
  try {
    return normalise(doc?.site || {});
  } catch {
    return defaults();
  }
}

// Deep-merge a partial update, validate, persist.
async function update(patch = {}) {
  const current = await get();
  const merged = {};
  for (const k of Object.keys(current)) {
    const p = patch?.[k];
    merged[k] = p && typeof p === "object" ? { ...current[k], ...p } : current[k];
  }
  if (patch?.homepage?.announcement) merged.homepage.announcement = { ...current.homepage.announcement, ...patch.homepage.announcement };
  const next = normalise(merged);
  await AppConfig.updateOne({ key: "default" }, { $set: { site: next } }, { upsert: true });
  appConfigService.invalidate();
  return next;
}

// Safe-to-publish subset for the frontend.
async function getPublic() {
  const s = await get();
  return {
    branding: s.branding,
    homepage: s.homepage,
    seo: s.seo,
    features: s.features,
    demoPayments: s.marketplace.demoPayments,
    growth: s.growth,
    maintenance: s.maintenance,
  };
}

async function feature(name) {
  return (await get()).features[name] !== false;
}
async function assertFeature(name, label) {
  if (!(await feature(name))) throw new ApiError(httpStatus.FORBIDDEN, `${label} is currently turned off by the site admin`);
}

module.exports = { get, update, getPublic, feature, assertFeature, defaults, normalise, HOME_SECTIONS };
