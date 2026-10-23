const { test, before } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data?.attributes ?? json?.data };
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, `login ${email}`);
  return { token: r.data.tokens.access.token, user: r.data.user };
};

const fresh = async (tag) => {
  const email = `gdpr-${tag}-${Date.now()}@example.com`;
  const r = await call("POST", "/auth/register", { body: { email, password: "Passw0rd!x", fullName: `Gdpr ${tag}`, role: "buyer" } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const MP = (process.env.MAILPIT_URL || "http://localhost:8025").replace(/\/+$/, "");
  let code;
  for (let i = 0; i < 40 && !code; i++) {
    const list = await (await fetch(`${MP}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`)).json();
    const id = list.messages?.[0]?.ID;
    if (id) code = String((await (await fetch(`${MP}/api/v1/message/${id}`)).json()).Text || "").match(/\b(\d{6})\b/)?.[1];
    if (!code) await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(code, "verification email");
  assert.equal((await call("POST", "/auth/verify-email", { body: { email, oneTimeCode: code } })).status, 200);
  const l = await login(email, "Passw0rd!x");
  assert.ok(l.token, "fresh user can sign in");
  return { email, ...l };
};

test("gdpr: self export and delete (anonymised, sign-in disabled)", async () => {
  const u = await fresh("self");
  const ex = await call("GET", "/users/me/export", { token: u.token });
  assert.equal(ex.status, 200);
  assert.equal(ex.json.user.email, u.email);
  assert.equal(ex.json.user.password, undefined, "no password hash");
  assert.equal(ex.json.user.twoFactorSecret, undefined);
  assert.ok(Array.isArray(ex.json.orders) && Array.isArray(ex.json.sessions));
  assert.ok(ex.json.sessions.every((s) => s.tokenHash === undefined));
  assert.equal((await call("POST", "/users/me/delete", { token: u.token, body: { password: "Passw0rd!x" } })).status, 400, "needs DELETE");
  assert.equal((await call("POST", "/users/me/delete", { token: u.token, body: { password: "wrong-Pass1", confirm: "DELETE" } })).status, 400);
  const d = await call("POST", "/users/me/delete", { token: u.token, body: { password: "Passw0rd!x", confirm: "DELETE" } });
  assert.equal(d.status, 200, JSON.stringify(d.json));
  assert.equal(d.data.erased, true);
  assert.equal((await call("GET", "/users/me/export", { token: u.token })).status, 401, "token revoked");
  const again = await call("POST", "/auth/login", { body: { email: u.email, password: "Passw0rd!x" } });
  assert.notEqual(again.status, 200, "cannot sign in");
  const admin = await login("admin@example.com", "Admin123!");
  const ad = await call("GET", `/admin/privacy/${d.data.userId}/export`, { token: admin.token });
  assert.equal(ad.json.user.fullName, "Deleted user");
  assert.match(ad.json.user.email, /@deleted\.invalid$/);
});

test("gdpr: admin erase is super-only and blocked by open orders", async () => {
  const sup = await login("admin@example.com", "Admin123!");
  const mod = await login("moderator@example.com", "Admin123!");
  const u = await fresh("admin");
  const id = (await call("GET", "/users/me/export", { token: u.token })).json.user.id;
  assert.equal((await call("GET", `/admin/privacy/${id}/export`, { token: mod.token })).status, 403);
  assert.equal((await call("POST", `/admin/privacy/${id}/erase`, { token: mod.token, body: { confirm: "ERASE" } })).status, 403);
  // Open orders block erasure. Only try it on the demo buyer when the
  // pre-check says it is blocked, so the test can never erase seed data.
  const buyer = await login("buyer@example.com", "Buyer123!");
  const chk = await call("GET", "/users/me/delete-check", { token: buyer.token });
  assert.equal(chk.status, 200);
  if (chk.data.blockers.length) {
    const bid = (await call("GET", "/users/me/export", { token: buyer.token })).json.user.id;
    const blocked = await call("POST", `/admin/privacy/${bid}/erase`, { token: sup.token, body: { confirm: "ERASE" } });
    assert.equal(blocked.status, 409, JSON.stringify(blocked.json));
  }
  const e = await call("POST", `/admin/privacy/${id}/erase`, { token: sup.token, body: { confirm: "ERASE" } });
  assert.equal(e.status, 200, JSON.stringify(e.json));
  assert.equal((await call("POST", `/admin/privacy/${id}/erase`, { token: sup.token, body: { confirm: "ERASE" } })).status, 404);
});
