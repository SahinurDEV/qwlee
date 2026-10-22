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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("custom admin roles: create, assign, change, delete", async () => {
  const sup = await login("admin@example.com", "Admin123!");
  const mod = await login("moderator@example.com", "Admin123!");
  const target = await login("ryan.patel@example.com", "Buyer123!");
  const uid = target.user.id;
  // Clean up a role left by an interrupted run.
  const old = (await call("GET", "/admin/roles", { token: sup.token })).data.custom.find((r) => r.key === "payout-desk");
  if (old) {
    await call("PATCH", `/admin/users/${uid}/role`, { token: sup.token, body: { role: "buyer" } });
    await call("DELETE", `/admin/roles/${old.id}`, { token: sup.token });
  }
  try {
    assert.equal((await call("POST", "/admin/roles", { token: mod.token, body: { name: "x", permissions: ["finance"] } })).status, 403);
    assert.equal((await call("POST", "/admin/roles", { token: sup.token, body: { name: "Payout desk", permissions: ["*"] } })).status, 400, "no wildcard");
    assert.equal((await call("POST", "/admin/roles", { token: sup.token, body: { name: "Finance", key: "finance", permissions: ["read"] } })).status, 400, "built-in key");
    const c = await call("POST", "/admin/roles", { token: sup.token, body: { name: "Payout desk", permissions: ["finance"] } });
    assert.equal(c.status, 200, JSON.stringify(c.json));
    assert.equal(c.data.key, "payout-desk");
    assert.deepEqual(c.data.permissions, ["read", "finance"], "read is always added");
    assert.equal((await call("POST", "/admin/roles", { token: sup.token, body: { name: "Payout desk", permissions: ["finance"] } })).status, 409);
    assert.equal((await call("PATCH", `/admin/users/${uid}/role`, { token: sup.token, body: { role: "admin", adminRole: "nope" } })).status, 400);
    assert.equal((await call("PATCH", `/admin/users/${uid}/role`, { token: sup.token, body: { role: "admin", adminRole: "payout-desk" } })).status, 200);
    await wait(1100);
    let me = await login("ryan.patel@example.com", "Buyer123!");
    const info = (await call("GET", "/admin/me", { token: me.token })).data;
    assert.equal(info.adminRole, "payout-desk");
    assert.deepEqual(info.permissions, ["read", "finance"]);
    assert.equal((await call("GET", "/withdrawal", { token: me.token })).status, 200, "finance allowed");
    assert.equal((await call("GET", "/admin/risk-flags", { token: me.token })).status, 403, "moderation denied");
    assert.equal((await call("PATCH", "/admin/settings/site", { token: me.token, body: {} })).status, 403);
    const team = (await call("GET", "/admin/team", { token: sup.token })).data;
    assert.deepEqual(team.roles["payout-desk"], ["read", "finance"], "matrix lists custom roles");

    // Swap finance for moderation: holders are signed out and get the new rights.
    assert.equal((await call("PATCH", `/admin/roles/${c.data.id}`, { token: sup.token, body: { permissions: ["moderation"] } })).status, 200);
    assert.equal((await call("GET", "/withdrawal", { token: me.token })).status, 401, "old session ended");
    await wait(1100);
    me = await login("ryan.patel@example.com", "Buyer123!");
    assert.equal((await call("GET", "/withdrawal", { token: me.token })).status, 403);
    assert.equal((await call("GET", "/admin/risk-flags", { token: me.token })).status, 200);

    assert.equal((await call("DELETE", `/admin/roles/${c.data.id}`, { token: sup.token })).status, 409, "role in use");
  } finally {
    await call("PATCH", `/admin/users/${uid}/role`, { token: sup.token, body: { role: "buyer" } });
    const r = (await call("GET", "/admin/roles", { token: sup.token })).data.custom.find((x) => x.key === "payout-desk");
    if (r) assert.equal((await call("DELETE", `/admin/roles/${r.id}`, { token: sup.token })).status, 200);
  }
});
