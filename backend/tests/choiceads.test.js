// Promoted gigs need the admin-set minimum level; qwlee's Choice runs in housekeeping.
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
  if (admin) await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { adsMinLevel: "new" } } });
});

test("only sellers at the minimum level can promote gigs", async () => {
  admin = await login("admin@example.com", "Admin123!");
  const seller = await login("thiago.ribeiro@example.com", "Seller123!");
  assert.equal((await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { adsMinLevel: "topRated" } } })).status, 200);
  const g = (await call("GET", "/gig/mine/stats", { token: seller.token })).data.gigs.find((x) => x.status === "active");
  const r = await call("POST", "/promotions", { token: seller.token, body: { gigId: g._id || g.id, days: 1 } });
  assert.equal(r.status, 403, JSON.stringify(r.json));
  assert.match(r.json.message, /Top Rated/);
});

test("housekeeping picks qwlee's Choice gigs", async () => {
  const run = await call("POST", "/admin/jobs/housekeeping", { token: admin.token });
  assert.equal(run.status, 200, JSON.stringify(run.json));
});
