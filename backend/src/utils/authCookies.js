// HttpOnly auth cookies for access + refresh tokens.
// Prefer same-site deployment (site and /api on one host). Cross-origin
// localhost still receives tokens in the JSON body so the Next set-session
// route can mirror HttpOnly cookies onto the page origin.

const ACCESS = "accessToken";
const REFRESH = "refreshToken";

function isHttps(req) {
  if (String(process.env.COOKIE_SECURE || "").toLowerCase() === "true") return true;
  if (String(process.env.COOKIE_SECURE || "").toLowerCase() === "false") return false;
  const proto = String(req?.headers?.["x-forwarded-proto"] || "").split(",")[0].trim();
  if (proto === "https") return true;
  return Boolean(req?.secure);
}

function baseOpts(req, { maxAgeMs } = {}) {
  const secure = isHttps(req);
  // SameSite=None required for cross-site API; Lax is fine same-site (/api proxy).
  const sameSite = (process.env.COOKIE_SAMESITE || (secure ? "lax" : "lax")).toLowerCase();
  const opts = {
    httpOnly: true,
    secure: sameSite === "none" ? true : secure,
    sameSite,
    path: "/",
  };
  if (maxAgeMs != null) opts.maxAge = maxAgeMs;
  const domain = process.env.COOKIE_DOMAIN;
  if (domain) opts.domain = domain;
  return opts;
}

function stripQuotes(v) {
  return String(v || "").replace(/^"(.*)"$/, "$1");
}

function parseCookieHeader(header, name) {
  if (!header) return null;
  for (const p of String(header).split(/; */)) {
    const i = p.indexOf("=");
    if (i === -1) continue;
    if (p.slice(0, i) !== name) continue;
    try {
      return stripQuotes(decodeURIComponent(p.slice(i + 1)));
    } catch {
      return stripQuotes(p.slice(i + 1));
    }
  }
  return null;
}

function readAccessToken(req) {
  if (req.cookies && req.cookies[ACCESS] != null) return stripQuotes(req.cookies[ACCESS]);
  return parseCookieHeader(req.headers?.cookie, ACCESS);
}

function readRefreshToken(req) {
  if (req.cookies && req.cookies[REFRESH] != null) return stripQuotes(req.cookies[REFRESH]);
  return parseCookieHeader(req.headers?.cookie, REFRESH);
}

function setAuthCookies(req, res, tokens = {}) {
  const access = tokens?.access?.token;
  const refresh = tokens?.refresh?.token;
  const accessMs = tokens?.access?.expires
    ? Math.max(0, new Date(tokens.access.expires).getTime() - Date.now())
    : 30 * 60 * 1000;
  const refreshMs = tokens?.refresh?.expires
    ? Math.max(0, new Date(tokens.refresh.expires).getTime() - Date.now())
    : 30 * 24 * 60 * 60 * 1000;
  if (access) res.cookie(ACCESS, access, baseOpts(req, { maxAgeMs: accessMs }));
  if (refresh) res.cookie(REFRESH, refresh, baseOpts(req, { maxAgeMs: refreshMs }));
}

function clearAuthCookies(req, res) {
  const opts = baseOpts(req);
  delete opts.maxAge;
  res.clearCookie(ACCESS, opts);
  res.clearCookie(REFRESH, opts);
}

module.exports = {
  ACCESS,
  REFRESH,
  setAuthCookies,
  clearAuthCookies,
  readAccessToken,
  readRefreshToken,
  parseCookieHeader,
  baseOpts,
};
