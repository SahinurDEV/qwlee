// Optional error reporting. When SENTRY_DSN (or ERROR_REPORTING_DSN) is set,
// events are POSTed to a Sentry-compatible store endpoint. With no DSN this
// is a no-op so local/demo stays quiet.

function dsn() {
  return String(process.env.SENTRY_DSN || process.env.ERROR_REPORTING_DSN || "").trim();
}

function enabled() {
  return Boolean(dsn());
}

async function captureException(err, context = {}) {
  if (!enabled()) return false;
  try {
    const url = dsn();
    // Prefer @sentry/node when installed; otherwise best-effort JSON POST.
    try {
      const Sentry = require("@sentry/node");
      if (Sentry?.captureException) {
        Sentry.captureException(err, { extra: context });
        return true;
      }
    } catch (_) {
      /* optional dep */
    }
    const payload = {
      message: err?.message || String(err),
      stack: err?.stack,
      context,
      ts: new Date().toISOString(),
      service: "qwlee-api",
    };
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    return true;
  } catch {
    return false;
  }
}

function initFromEnv() {
  const D = dsn();
  if (!D) return;
  try {
    const Sentry = require("@sentry/node");
    if (Sentry?.init) {
      Sentry.init({ dsn: D, environment: process.env.NODE_ENV || "development" });
      require("../config/logger").info("Sentry error reporting enabled");
    }
  } catch {
    require("../config/logger").info("ERROR_REPORTING_DSN set (custom endpoint; @sentry/node not installed)");
  }
}

module.exports = { dsn, enabled, captureException, initFromEnv };
