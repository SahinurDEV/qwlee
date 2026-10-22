// Google sign-in. When the API runs with GOOGLE_CLIENT_ID/SECRET and
// GOOGLE_TOKEN_URL=http://127.0.0.1:<FAKE_GOOGLE_PORT>/token, this file
// plays Google's token endpoint. Otherwise it checks the feature is off.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const PORT = Number(process.env.FAKE_GOOGLE_PORT || 19999);
const CLIENT_ID = process.env.GOOGLE_TEST_CLIENT_ID || "test-client";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
let server;
let enabled = false;

before(async () => {
  const r = await fetch(`${API}/v1/auth/google/config`).then((x) => x.json());
  enabled = !!r?.data?.attributes?.enabled;
  if (!enabled) return;
  // code format: <email>|<sub>|<verified>
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d)).on("end", () => {
      const p = new URLSearchParams(body);
      if (p.get("client_secret") == null || p.get("grant_type") !== "authorization_code") {
        res.writeHead(400).end(JSON.stringify({ error: "invalid_request" }));
        return;
      }
      const [email, sub, verified] = String(p.get("code")).split("|");
      if (!email) return res.writeHead(400).end(JSON.stringify({ error: "invalid_grant" }));
      const claims = { iss: "https://accounts.google.com", aud: CLIENT_ID, sub, email, email_verified: verified === "1", name: "Google Person", exp: Math.floor(Date.now() / 1000) + 600 };
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id_token: `${b64({ alg: "RS256" })}.${b64(claims)}.sig`, access_token: "x" }));
    });
  });
  await new Promise((ok) => server.listen(PORT, "127.0.0.1", ok));
});
after(() => server?.close());

async function start(from = "/gig") {
  const r = await fetch(`${API}/v1/auth/google?from=${encodeURIComponent(from)}`, { redirect: "manual" });
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get("location"));
  const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
  return { state: loc.searchParams.get("state"), cookie, loc };
}
async function callback({ state, cookie }, code) {
  const r = await fetch(`${API}/v1/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
  assert.equal(r.status, 302);
  return new URL(r.headers.get("location"));
}
const exchange = (code) =>
  fetch(`${API}/v1/auth/google/exchange`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }).then(async (r) => ({ status: r.status, json: await r.json() }));

test("google sign-in is hidden when not configured", { skip: false }, async (t) => {
  if (enabled) return t.skip("configured in this run");
  const r = await fetch(`${API}/v1/auth/google`, { redirect: "manual" });
  assert.equal(r.status, 404);
});

test("google sign-in: new account, single-use code, state bound to browser", async (t) => {
  if (!enabled) return t.skip("GOOGLE_CLIENT_ID not set on the API");
  const s = await start("/requests");
  assert.equal(s.loc.searchParams.get("client_id"), CLIENT_ID);
  assert.match(s.loc.searchParams.get("scope"), /email/);
  assert.ok(s.cookie.startsWith("qwlee_g_state="));

  const email = `g-${Date.now()}@example.com`;
  // Without the browser's state cookie (login CSRF) it is refused.
  const csrf = await callback({ state: s.state, cookie: "" }, `${email}|sub-${Date.now()}|1`);
  assert.equal(csrf.searchParams.get("error"), "invalid_state");

  const sub = `sub-${Date.now()}`;
  const ok = await callback(s, `${email}|${sub}|1`);
  assert.equal(ok.pathname, "/auth/google/callback");
  assert.equal(ok.searchParams.get("from"), "/requests");
  const code = ok.searchParams.get("code");
  assert.ok(code && !ok.search.includes("token"), "no tokens in the URL");

  const ex = await exchange(code);
  assert.equal(ex.status, 200, JSON.stringify(ex.json));
  const { user, tokens } = ex.json.data.attributes;
  assert.equal(user.email, email);
  assert.equal(user.role, "buyer");
  assert.equal(user.isEmailVerified, true);
  assert.equal(user.googleId, undefined, "googleId is private");
  assert.ok(tokens.access.token);
  assert.equal((await exchange(code)).status, 401, "code is single use");

  // Same Google account again -> same user.
  const s2 = await start();
  const again = await exchange((await callback(s2, `${email}|${sub}|1`)).searchParams.get("code"));
  assert.equal(again.json.data.attributes.user.id, user.id);

  // Password login is refused for a Google-only account (no 500).
  const pw = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "Whatever123!" }) });
  assert.equal(pw.status, 401);
});

test("google sign-in: unverified Google email refused; existing account linked", async (t) => {
  if (!enabled) return t.skip("GOOGLE_CLIENT_ID not set on the API");
  const bad = await callback(await start(), `nov-${Date.now()}@example.com|s-${Date.now()}|0`);
  assert.equal(bad.searchParams.get("error"), "email_not_verified");

  const login = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "buyer@example.com", password: "Buyer123!" }) }).then((r) => r.json());
  const existingId = login.data.attributes.user.id;
  const linked = await exchange((await callback(await start(), `buyer@example.com|gbuyer-${Date.now()}|1`)).searchParams.get("code"));
  assert.equal(linked.json.data.attributes.user.id, existingId);

  // Pre-registered but unverified account: Google owner takes it over and
  // the squatter's password stops working.
  const email = `squat-${Date.now()}@example.com`;
  await fetch(`${API}/v1/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "Squat123!x", fullName: "Squatter" }) });
  const taken = await exchange((await callback(await start(), `${email}|sq-${Date.now()}|1`)).searchParams.get("code"));
  assert.equal(taken.status, 200);
  const pw = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "Squat123!x" }) });
  assert.equal(pw.status, 401);
});
