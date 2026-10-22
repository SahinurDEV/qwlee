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

test("kpi: funnel, cohorts, weekly summary and manual email (super only)", async () => {
  const sup = await login("admin@example.com", "Admin123!");
  const fin = await login("finance@example.com", "Admin123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  assert.equal((await call("GET", "/admin/kpi/funnel", { token: buyer.token })).status, 403);
  const f = await call("GET", "/admin/kpi/funnel?days=365", { token: fin.token });
  assert.equal(f.status, 200, JSON.stringify(f.json));
  assert.equal(f.data.buyer.length, 3);
  assert.ok(f.data.buyer[0].count >= f.data.buyer[1].count && f.data.buyer[1].count >= f.data.buyer[2].count, "funnel narrows");
  assert.equal(f.data.buyer[0].ofFirst, f.data.buyer[0].count ? 100 : 0);
  const c = await call("GET", "/admin/kpi/cohorts?months=3", { token: fin.token });
  assert.equal(c.data.rows.length, 3);
  c.data.rows.forEach((r, i) => assert.equal(r.retention.length, 3 - i, "triangle shape"));
  const w = await call("GET", "/admin/kpi/weekly", { token: fin.token });
  for (const k of ["signups", "orders", "gmv", "completed", "fees", "disputes"]) assert.equal(typeof w.data.current[k], "number");
  assert.equal((await call("POST", "/admin/jobs/kpi-email", { token: fin.token })).status, 403, "finance can't send");
  const s = await call("POST", "/admin/jobs/kpi-email", { token: sup.token });
  assert.equal(s.status, 200, JSON.stringify(s.json));
  assert.equal(s.data.sent, true);
  assert.ok(s.data.recipients >= 1);
});
