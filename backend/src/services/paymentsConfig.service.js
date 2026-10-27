// Payment provider readiness. Stripe is preferred whenever
// STRIPE_SECRET_KEY is set; DEMO_PAYMENTS is only a fallback for local
// / staging demos. Never flip DEMO_PAYMENTS=false in production until
// Stripe keys (and webhook secret) are configured — checkout will 503.

function stripeSecret() {
  return String(process.env.STRIPE_SECRET_KEY || "").trim();
}

function stripeWebhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
}

function stripePublishable() {
  return String(
    process.env.STRIPE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
      ""
  ).trim();
}

function demoPaymentsEnabled() {
  return String(process.env.DEMO_PAYMENTS || "").toLowerCase() === "true";
}

/** Lazy Stripe SDK — null when no secret key. */
let _stripe = null;
let _stripeKey = "";
function getStripe() {
  const key = stripeSecret();
  if (!key) return null;
  if (!_stripe || _stripeKey !== key) {
    _stripe = require("stripe")(key);
    _stripeKey = key;
  }
  return _stripe;
}

/**
 * Public, non-secret snapshot for /health and admin.
 * mode: "stripe" | "demo" | "unconfigured"
 */
function readiness() {
  const stripe = Boolean(stripeSecret());
  const webhook = Boolean(stripeWebhookSecret());
  const publishable = Boolean(stripePublishable());
  const demo = demoPaymentsEnabled();
  let mode = "unconfigured";
  if (stripe) mode = "stripe";
  else if (demo) mode = "demo";
  return {
    mode,
    stripeConfigured: stripe,
    webhookConfigured: webhook,
    publishableConfigured: publishable,
    demoPayments: demo,
    // True when live card checkout can complete (secret + webhook).
    readyForLiveCharges: stripe && webhook,
  };
}

function assertCheckoutAvailable() {
  const r = readiness();
  if (r.mode === "unconfigured") {
    const ApiError = require("../utils/ApiError");
    const httpStatus = require("http-status");
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Payments are not configured. Set STRIPE_SECRET_KEY (+ STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY), or DEMO_PAYMENTS=true for a demo."
    );
  }
  return r;
}

module.exports = {
  getStripe,
  stripeSecret,
  stripeWebhookSecret,
  stripePublishable,
  demoPaymentsEnabled,
  readiness,
  assertCheckoutAvailable,
};
