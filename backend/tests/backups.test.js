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

test("backups: status needs settings, run-now is super only and produces an archive", async (t) => {
  const sup = await login("admin@example.com", "Admin123!");
  const fin = await login("finance@example.com", "Admin123!");
  assert.equal((await call("GET", "/admin/backups", { token: fin.token })).status, 403);
  const s = await call("GET", "/admin/backups", { token: sup.token });
  assert.equal(s.status, 200, JSON.stringify(s.json));
  if (!s.data.configured) return t.skip("backup service not running");
  assert.equal((await call("POST", "/admin/backups/run", { token: fin.token })).status, 403);
  const before = s.data.last?.at || "";
  assert.equal((await call("POST", "/admin/backups/run", { token: sup.token })).status, 200);
  let now;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    now = (await call("GET", "/admin/backups", { token: sup.token })).data;
    if (now.last && now.last.at !== before && !now.pending) break;
  }
  assert.notEqual(now.last.at, before, "a new backup ran");
  assert.equal(now.last.ok, true, now.last.error);
  assert.equal(now.health, "ok");
  assert.ok(now.files.some((f) => f.name === now.last.file && f.bytes > 1000));
});
