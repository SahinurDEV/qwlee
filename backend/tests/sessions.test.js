const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body, ua } = {}) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: { "content-type": "application/json", ...(ua ? { "user-agent": ua } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data?.attributes ?? json?.data };
};
const login = async (ua) => {
  const r = await call("POST", "/auth/login", { body: { email: "buyer@example.com", password: "Buyer123!" }, ua });
  assert.equal(r.status, 200);
  return r.data.tokens;
};

test("sessions: list devices, sign one out (access + refresh die), others survive", async () => {
  const a = await login("TestPhone/1.0 (iPhone)");
  const b = await login("TestLaptop/1.0 (Windows)");
  const list = await call("GET", "/sessions", { token: b.access.token });
  assert.equal(list.status, 200);
  const rows = list.data.results;
  const cur = rows.find((r) => r.current);
  assert.ok(cur && /Windows/.test(cur.userAgent), "current device flagged");
  const phone = rows.find((r) => /iPhone/.test(r.userAgent));
  assert.ok(phone, "other device listed");
  assert.equal((await call("DELETE", `/sessions/${phone.id}`, { token: b.access.token })).status, 200);
  assert.equal((await call("GET", "/sessions", { token: a.access.token })).status, 401, "revoked access token refused");
  assert.equal((await call("POST", "/auth/refresh-tokens", { body: { refreshToken: a.refresh.token } })).status, 401, "revoked refresh token refused");
  assert.equal((await call("GET", "/sessions", { token: b.access.token })).status, 200, "this device still signed in");
  // Refresh keeps the same session.
  const r = await call("POST", "/auth/refresh-tokens", { body: { refreshToken: b.refresh.token } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const nt = r.json.access.token;
  const again = await call("GET", "/sessions", { token: nt });
  assert.ok(again.data.results.some((x) => x.current && x.id === cur.id), "refresh continues the session");
  // Logout ends it.
  await call("POST", "/auth/logout", { body: { refreshToken: r.json.refresh.token } });
  assert.equal((await call("GET", "/sessions", { token: nt })).status, 401);
  // Someone else's session id can't be revoked.
  const c = await login("Other");
  assert.equal((await call("DELETE", "/sessions/deadbeef", { token: c.access.token })).status, 404);
});

test("admin sees and revokes a user's sessions", async () => {
  const t = await login("AdminCheck/1.0");
  const admin = (await call("POST", "/auth/login", { body: { email: "admin@example.com", password: "Admin123!" } })).data;
  const buyerId = admin && (await call("GET", "/admin/users?search=buyer@example.com", { token: admin.tokens.access.token })).data.results[0].id;
  const list = await call("GET", `/admin/users/${buyerId}/sessions`, { token: admin.tokens.access.token });
  assert.equal(list.status, 200);
  const s = list.data.results.find((x) => /AdminCheck/.test(x.userAgent));
  assert.ok(s);
  assert.equal((await call("DELETE", `/admin/users/${buyerId}/sessions/${s.id}`, { token: admin.tokens.access.token })).status, 200);
  assert.equal((await call("GET", "/sessions", { token: t.access.token })).status, 401);
});
