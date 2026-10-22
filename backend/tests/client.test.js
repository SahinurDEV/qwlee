const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, data: json?.data?.attributes ?? json?.data };
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200);
  return { token: r.data.tokens.access.token, user: r.data.user };
};

test("gig slug-exists answers for real and unknown slugs", async () => {
  const gig = (await call("GET", "/gig?limit=1")).data.results[0];
  assert.equal((await call("GET", `/gig/slug-exists?slug=${encodeURIComponent(gig.slug)}`)).data.exists, true);
  assert.equal((await call("GET", "/gig/slug-exists?slug=definitely-not-a-gig-xyz")).data.exists, false);
});

test("geo lookup never errors", async () => {
  const r = await call("GET", "/info/geo");
  assert.equal(r.status, 200);
  assert.ok("countryCode" in r.data);
});

test("newsletter: validates, is idempotent, admin can list/export, finance cannot", async () => {
  const email = `nl-${Date.now()}@example.com`;
  assert.equal((await call("POST", "/newsletter", { body: { email: "nope" } })).status, 400);
  assert.equal((await call("POST", "/newsletter", { body: { email } })).status, 200);
  assert.equal((await call("POST", "/newsletter", { body: { email: email.toUpperCase() } })).status, 200, "same answer for repeats");
  const sup = await login("admin@example.com", "Admin123!");
  const list = await call("GET", `/admin/newsletter?search=${encodeURIComponent(email)}`, { token: sup.token });
  assert.equal(list.data.totalResults, 1);
  const csv = await call("GET", `/admin/newsletter?format=csv&search=${encodeURIComponent(email)}`, { token: sup.token });
  assert.match(csv.text, new RegExp(email.replace(/[.]/g, "\\.")));
  const fin = await login("finance@example.com", "Admin123!");
  assert.equal((await call("GET", "/admin/newsletter", { token: fin.token })).status, 403);
  const mod = await login("moderator@example.com", "Admin123!");
  assert.equal((await call("GET", "/withdrawal", { token: mod.token })).status, 403, "moderators can't read payouts");
});

test("activity beacon: token in body is accepted", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const r = await call("POST", "/activity/track", { body: { route: "/test", _bearer: buyer.token } });
  assert.ok(r.status < 300, `beacon status ${r.status}`);
});
