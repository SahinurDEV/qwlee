// Runtime-editable platform settings.
//
// `getConfig()` lazily creates the singleton seeded from .env so the
// existing Stripe / SMTP env vars don't suddenly break on upgrade —
// the admin can then take over the values from the UI.
//
// `getPublicMethods()` returns the enabled-payments shortlist with
// **no secrets**, safe for the checkout page.

const { AppConfig } = require("../models");

const SINGLETON_KEY = "default";

function fromEnv() {
  return {
    key: SINGLETON_KEY,
    payments: {
      stripe: {
        enabled: !!process.env.STRIPE_SECRET_KEY,
        mode: (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live")
          ? "live"
          : "test",
        credentials: {
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
          secretKey: process.env.STRIPE_SECRET_KEY || "",
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
        },
      },
      paypal: { enabled: false, mode: "test", credentials: {} },
      paddle: { enabled: false, mode: "test", credentials: {} },
      lemonsqueezy: { enabled: false, mode: "test", credentials: {} },
      sslcommerz: { enabled: false, mode: "test", credentials: {} },
    },
    customPayments: [],
    smtp: {
      host: process.env.SMTP_HOST || "",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || process.env.SMTP_USERNAME || "",
      pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "",
      fromEmail: process.env.SMTP_FROM_EMAIL || process.env.EMAIL_FROM || "",
      fromName: process.env.SMTP_FROM_NAME || "",
    },
    misc: {},
  };
}

let cached = null;

// Strip credentials before returning to non-admin callers. The
// admin endpoints can still get the full doc via `getConfig()`.
function publicProvider(p, id, label, descriptors) {
  if (!p?.enabled) return null;
  return {
    id,
    label,
    mode: p.mode,
    // Only return a "ready" flag so the checkout page can decide if
    // the method can be offered. Never leak the secret key itself.
    ready: descriptors.every((k) => !!p.credentials?.[k]),
  };
}

async function getConfig() {
  if (cached) return cached;
  const existing = await AppConfig.findOne({ key: SINGLETON_KEY });
  if (existing) {
    cached = existing;
    return existing;
  }
  const seeded = await AppConfig.create(fromEnv());
  cached = seeded;
  return seeded;
}

function invalidate() {
  cached = null;
}

async function updateConfig(patch = {}) {
  const doc = await getConfig();
  // Deep-merge each top-level key independently so a PATCH that only
  // touches { payments: { paypal: {...} } } doesn't wipe SMTP or other
  // providers.
  if (patch.payments) {
    for (const [k, v] of Object.entries(patch.payments)) {
      doc.payments[k] = {
        ...(doc.payments[k] || {}),
        ...v,
        credentials: {
          ...((doc.payments[k] && doc.payments[k].credentials) || {}),
          ...(v.credentials || {}),
        },
      };
    }
    doc.markModified("payments");
  }
  if (Array.isArray(patch.customPayments)) {
    doc.customPayments = patch.customPayments;
    doc.markModified("customPayments");
  }
  if (patch.smtp) {
    doc.smtp = { ...doc.smtp.toObject?.() || doc.smtp, ...patch.smtp };
    doc.markModified("smtp");
  }
  if (patch.misc && typeof patch.misc === "object") {
    doc.misc = { ...(doc.misc || {}), ...patch.misc };
    doc.markModified("misc");
  }
  if (Array.isArray(patch.sellerLevels)) {
    doc.sellerLevels = patch.sellerLevels;
    doc.markModified("sellerLevels");
  }
  await doc.save();
  invalidate();
  return doc;
}

async function addCustomPayment(payload) {
  const doc = await getConfig();
  const id = String(payload.id || payload.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .slice(0, 32);
  if (!id) throw new Error("Custom provider needs a name");
  if (doc.customPayments.find((c) => c.id === id)) {
    throw new Error("A custom provider with that id already exists");
  }
  doc.customPayments.push({
    id,
    name: payload.name || id,
    description: payload.description || "",
    iconUrl: payload.iconUrl || "",
    enabled: !!payload.enabled,
    mode: payload.mode === "live" ? "live" : "test",
    credentials: payload.credentials || {},
    checkoutUrlTemplate: payload.checkoutUrlTemplate || "",
  });
  doc.markModified("customPayments");
  await doc.save();
  invalidate();
  return doc;
}

async function removeCustomPayment(id) {
  const doc = await getConfig();
  doc.customPayments = doc.customPayments.filter((c) => c.id !== id);
  doc.markModified("customPayments");
  await doc.save();
  invalidate();
  return doc;
}

// Snapshot suitable for the checkout page — no secrets, just which
// methods are live and ready.
async function getPublicMethods() {
  const doc = await getConfig();
  const built = [
    publicProvider(doc.payments.stripe, "stripe", "Stripe", ["secretKey"]),
    publicProvider(doc.payments.paypal, "paypal", "PayPal", [
      "clientId",
      "clientSecret",
    ]),
    publicProvider(doc.payments.paddle, "paddle", "Paddle", ["apiKey"]),
    publicProvider(
      doc.payments.lemonsqueezy,
      "lemonsqueezy",
      "Lemon Squeezy",
      ["apiKey", "storeId"]
    ),
    publicProvider(doc.payments.sslcommerz, "sslcommerz", "SSLCommerz", [
      "storeId",
      "storePassword",
    ]),
  ].filter(Boolean);

  const custom = (doc.customPayments || [])
    .filter((c) => c.enabled)
    .map((c) => ({
      id: c.id,
      label: c.name,
      mode: c.mode,
      description: c.description,
      iconUrl: c.iconUrl,
      ready: !!c.checkoutUrlTemplate || Object.keys(c.credentials || {}).length > 0,
      custom: true,
    }));

  return [...built, ...custom];
}

// Platform commission taken from each completed order, in percent.
// Admin can override it in Settings > Misc with key `platformFeePercent`;
// otherwise PLATFORM_FEE_PERCENT from the environment, default 5.
// Pass the order's gigId to apply a per-category rule (Site settings →
// Marketplace → Category fees): the gig's sub-category rule wins, then its
// category's, then the default.
// Fee actually charged: the rule below, minus the seller's Seller Plus
// discount (sellerPlan.service), never below 0.
async function getPlatformFeePercent(gigId) {
  const base = await baseFeePercent(gigId);
  if (!gigId) return base;
  const gig = await require("../models/gig.model").findById(gigId, "userId").lean().catch(() => null);
  const off = gig ? await require("./sellerPlan.service").feeDiscount(gig.userId) : 0;
  return Math.max(0, Math.round((base - off) * 100) / 100);
}

async function baseFeePercent(gigId) {
  const doc = await getConfig();
  const raw = doc?.site?.marketplace?.feePercent ?? doc?.misc?.platformFeePercent ?? process.env.PLATFORM_FEE_PERCENT ?? 5;
  const pct = Number(raw);
  const base = Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : 5;
  const rules = doc?.site?.marketplace?.categoryFees;
  if (!gigId || !Array.isArray(rules) || !rules.length) return base;
  const gig = await require("../models/gig.model").findById(gigId, "categoriesId subCategoryId").lean().catch(() => null);
  if (!gig) return base;
  const by = new Map(rules.map((r) => [String(r.categoryId), Number(r.percent)]));
  for (const id of [gig.subCategoryId, gig.categoriesId]) {
    const v = id && by.get(String(id));
    if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
  }
  return base;
}

module.exports = {
  getPlatformFeePercent,
  getConfig,
  updateConfig,
  addCustomPayment,
  removeCustomPayment,
  getPublicMethods,
  invalidate,
};
