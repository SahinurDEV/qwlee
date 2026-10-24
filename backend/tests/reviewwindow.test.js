// Review window: admin setting, published in the public policy block.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}/v1${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data?.attributes };
};

test("review window defaults to 14 days and is public", async () => {
  const pub = (await call("GET", "/info/site")).data;
  assert.equal(pub.policy.reviewWindowDays, 14);
  const r = await call("POST", "/auth/login", { body: { email: "admin@example.com", password: "Admin123!" } });
  const token = r.data.tokens.access.token;
  assert.equal((await call("PATCH", "/admin/settings/site", { token, body: { marketplace: { reviewWindowDays: 400 } } })).status, 400);
  assert.equal((await call("PATCH", "/admin/settings/site", { token, body: { marketplace: { reviewWindowDays: 14 } } })).status, 200);
});
