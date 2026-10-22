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

test("job monitor: housekeeping steps are recorded; run now is super only", async () => {
  const sup = await login("admin@example.com", "Admin123!");
  const fin = await login("finance@example.com", "Admin123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  assert.equal((await call("GET", "/admin/jobs/status", { token: buyer.token })).status, 403);
  assert.equal((await call("POST", "/admin/jobs/housekeeping", { token: fin.token })).status, 403);
  const t0 = Date.now();
  const r = await call("POST", "/admin/jobs/housekeeping", { token: sup.token });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(typeof r.data.markedLate, "number");
  const s = await call("GET", "/admin/jobs/status", { token: fin.token });
  assert.equal(s.status, 200);
  assert.equal(s.data.jobs.length, 7);
  for (const j of s.data.jobs) {
    assert.ok(j.lastRun, `${j.job} recorded`);
    assert.ok(new Date(j.lastRun.startedAt).getTime() >= t0 - 1000, `${j.job} is this run`);
    assert.equal(j.lastRun.trigger, "manual");
    assert.equal(j.health, j.lastRun.ok ? "ok" : "failing");
  }
  const h = await call("GET", "/admin/jobs/history?job=markLate&limit=5", { token: fin.token });
  assert.ok(h.data.results.length >= 1 && h.data.results.every((x) => x.job === "markLate"));
});
