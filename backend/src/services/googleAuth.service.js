// "Sign in with Google" using the OAuth 2.0 authorization-code flow.
// Enabled only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
//
// Flow: /auth/google -> Google consent -> /auth/google/callback (code
// exchanged server-side with the client secret) -> redirect to the
// frontend with a short-lived single-use login code -> the frontend
// POSTs it to /auth/google/exchange for the normal {user, tokens}.
// Access tokens never appear in a URL.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const httpStatus = require("http-status");
const ApiError = require("../utils/ApiError");
const config = require("../config/config");
const { tokenTypes } = require("../config/tokens");
const { User, Token } = require("../models");
const { deriveUniqueUsername } = require("../utils/deriveUsername");

const AUTH_URL = process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const ISSUERS = ["accounts.google.com", "https://accounts.google.com", ...(process.env.GOOGLE_ISSUER ? [process.env.GOOGLE_ISSUER] : [])];
const STATE_COOKIE = "qwlee_g_state";
const LOGIN_CODE_TTL_MS = 2 * 60 * 1000;

const isEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:8000").replace(/\/+$/, "");
const redirectUri = () =>
  process.env.GOOGLE_REDIRECT_URI ||
  `${(process.env.PUBLIC_API_URL || "http://localhost:7171").replace(/\/+$/, "")}/v1/auth/google/callback`;
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const safeFrom = (f) => (typeof f === "string" && f.startsWith("/") && !f.startsWith("//") ? f.slice(0, 300) : "/");

const assertEnabled = () => {
  if (!isEnabled()) throw new ApiError(httpStatus.NOT_FOUND, "Google sign-in is not configured");
};

/** Build the Google consent URL plus the nonce to bind in a cookie. */
const safeRef = (r) => (typeof r === "string" && /^[a-f0-9]{8}$/.test(r) ? r : undefined);

const startAuth = ({ from, ref } = {}) => {
  assertEnabled();
  const nonce = crypto.randomBytes(16).toString("hex");
  const state = jwt.sign({ n: nonce, from: safeFrom(from), ...(safeRef(ref) ? { ref: safeRef(ref) } : {}) }, config.jwt.secret, { expiresIn: "10m" });
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), nonce };
};

const readCookie = (req, name) => {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
};

const decodeIdToken = (idToken) => {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed id_token");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
};

/**
 * Handle Google's redirect. Returns the frontend URL to send the browser to.
 * The id_token comes straight from Google's token endpoint over TLS using
 * our client secret, so (per OpenID Connect Core 3.1.3.7) its claims are
 * trusted after checking iss / aud / exp / email_verified.
 */
const handleCallback = async (req) => {
  assertEnabled();
  const fail = (code) => `${frontendUrl()}/auth/google/callback?error=${encodeURIComponent(code)}`;
  const { code, state, error } = req.query;
  if (error) return fail("cancelled");
  let st;
  try {
    st = jwt.verify(String(state || ""), config.jwt.secret);
  } catch {
    return fail("invalid_state");
  }
  const cookieNonce = readCookie(req, STATE_COOKIE);
  if (!cookieNonce || cookieNonce !== st.n) return fail("invalid_state");
  if (!code) return fail("missing_code");

  let claims;
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
      }),
    });
    const body = await res.json();
    if (!res.ok || !body.id_token) throw new Error(body.error || `token endpoint ${res.status}`);
    claims = decodeIdToken(body.id_token);
  } catch (e) {
    require("../config/logger").warn(`Google token exchange failed: ${e.message}`);
    return fail("exchange_failed");
  }
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!ISSUERS.includes(claims.iss) || !aud.includes(process.env.GOOGLE_CLIENT_ID) || !(claims.exp * 1000 > Date.now())) {
    return fail("invalid_token");
  }
  if (!claims.sub || !claims.email || !(claims.email_verified === true || claims.email_verified === "true")) {
    return fail("email_not_verified");
  }

  const user = await findOrCreateUser(claims);
  // Brand-new Google accounts honour a referral link (?ref=) like the form.
  if (user.$locals?.created && safeRef(st.ref)) await require("./referral.service").attach(user, st.ref);
  if (user.isDeleted) return fail("account_deleted");
  if (user.isBan) return fail("banned");

  const loginCode = crypto.randomBytes(32).toString("hex");
  await Token.create({
    token: sha256(loginCode),
    user: user._id,
    type: tokenTypes.OAUTH_LOGIN,
    expires: new Date(Date.now() + LOGIN_CODE_TTL_MS),
  });
  return `${frontendUrl()}/auth/google/callback?code=${loginCode}&from=${encodeURIComponent(safeFrom(st.from))}`;
};

const findOrCreateUser = async (claims) => {
  const email = String(claims.email).toLowerCase();
  let user = await User.findOne({ googleId: claims.sub });
  if (user) return user;
  user = await User.findOne({ email });
  if (user) {
    // Google has verified the address. If the local account never
    // verified it, someone else may have registered it: drop that
    // password so only the real owner (via Google or reset) gets in.
    if (!user.isEmailVerified) {
      user.password = undefined;
      user.isEmailVerified = true;
    }
    user.googleId = claims.sub;
    if (!user.image && claims.picture) user.image = claims.picture;
    await user.save();
    return user;
  }
  const created = await User.create({
    email,
    fullName: String(claims.name || email.split("@")[0]).slice(0, 80),
    username: await deriveUniqueUsername(email.split("@")[0]),
    role: "buyer",
    isEmailVerified: true,
    googleId: claims.sub,
    image: claims.picture || "",
  });
  created.$locals.created = true;
  return created;
};

/** Swap the single-use login code for the user (tokens issued by caller). */
const exchangeLoginCode = async (code) => {
  assertEnabled();
  if (typeof code !== "string" || code.length < 32) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid login code");
  const doc = await Token.findOneAndDelete({
    token: sha256(code),
    type: tokenTypes.OAUTH_LOGIN,
    expires: { $gt: new Date() },
  });
  if (!doc) throw new ApiError(httpStatus.UNAUTHORIZED, "Login code expired or already used");
  const user = await User.findById(doc.user);
  if (!user || user.isDeleted) throw new ApiError(httpStatus.UNAUTHORIZED, "Account not available");
  if (user.isBan) throw new ApiError(httpStatus.FORBIDDEN, `BANNED:${user.banReason || "Your account has been suspended by an administrator."}`);
  return user;
};

module.exports = { isEnabled, startAuth, handleCallback, exchangeLoginCode, STATE_COOKIE };
