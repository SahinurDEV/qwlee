// SMTP readiness. Credentials come from env (and optionally AppConfig via
// email.service). This helper only inspects process.env so /health and boot
// logs stay cheap and secret-free.

function host() {
  return String(process.env.SMTP_HOST || "").trim();
}
function port() {
  const n = Number(process.env.SMTP_PORT || 0);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function user() {
  return String(process.env.SMTP_USER || process.env.SMTP_USERNAME || "").trim();
}
function pass() {
  return String(process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "").trim();
}
function from() {
  return String(
    process.env.SMTP_FROM ||
      process.env.SMTP_FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      ""
  ).trim();
}

function looksLikeLocalCatcher(h = host()) {
  const x = String(h || "").toLowerCase();
  return (
    !x ||
    x === "127.0.0.1" ||
    x === "localhost" ||
    x === "mailpit" ||
    x === "mailhog" ||
    x.endsWith(".local")
  );
}

/**
 * Public snapshot — never includes passwords.
 * mode: "configured" | "local-catcher" | "unconfigured"
 */
function readiness() {
  const h = host();
  const p = port();
  const u = user();
  const f = from();
  const hasAuth = Boolean(u && pass());
  const local = looksLikeLocalCatcher(h);
  let mode = "unconfigured";
  if (h && p) {
    mode = local ? "local-catcher" : "configured";
  }
  return {
    mode,
    hostConfigured: Boolean(h),
    port: p,
    authConfigured: hasAuth,
    fromConfigured: Boolean(f),
    // Ready for real outbound mail (not Mailpit/localhost).
    readyForLiveMail: mode === "configured" && Boolean(f),
  };
}

module.exports = {
  host,
  port,
  user,
  pass,
  from,
  looksLikeLocalCatcher,
  readiness,
};
