// Gig caps per seller level (admin setting).
const { test, after } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}/v1${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data?.attributes };
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200);
  return { token: r.data.tokens.access.token, user: r.data.user };
};

let admin;
after(async () => {
  if (admin) await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { gigCaps: { new: 0, level1: 0, level2: 0, topRated: 0 } } } });
});

test("sellers at their level's gig cap cannot create another gig", async () => {
  admin = await login("admin@example.com", "Admin123!");
  const r = await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { gigCaps: { new: 1, level1: 1, level2: 1, topRated: 1 } } } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.data.site.marketplace.gigCaps.level1, 1);
  const seller = await login("seller@example.com", "Seller123!");
  const form = new FormData();
  form.append("title", `Cap test ${Date.now()}`);
  form.append("description", "x".repeat(200));
  const res = await fetch(`${API}/v1/gig`, { method: "POST", headers: { authorization: `Bearer ${seller.token}` }, body: form });
  const j = await res.json().catch(() => null);
  assert.equal(res.status, 409, JSON.stringify(j));
  assert.match(j.message, /up to 1 gigs/);
});
