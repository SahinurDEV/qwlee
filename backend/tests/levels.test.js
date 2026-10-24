// Seller levels: Fiverr-style default criteria, stored level as the single
// source for badges and the search filter, Top Rated needs approval.
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
const idOf = (v) => String(v?.id || v?._id || v || "");

let admin, seller;
after(async () => {
  if (admin && seller) {
    await call("PATCH", `/admin/seller-levels/${seller.user.id}/override`, { token: admin.token, body: { tierId: "" } });
    await call("POST", `/admin/seller-levels/${seller.user.id}/top-rated`, { token: admin.token, body: { action: "reset" } });
  }
});

test("default tiers follow Fiverr's criteria", async () => {
  admin = await login("admin@example.com", "Admin123!");
  const r = await call("GET", "/admin/seller-levels/tiers", { token: admin.token });
  assert.equal(r.status, 200);
  const tiers = r.data.tiers || r.data;
  const by = Object.fromEntries(tiers.map((t) => [t.id, t]));
  assert.equal(by.level1.minOrders, 5);
  assert.equal(by.level1.minRating, 4.4);
  assert.equal(by.level1.minResponseRate, 80);
  assert.equal(by.level2.minEarnings, 2000);
  assert.equal(by.topRated.minEarnings, 10000);
  assert.equal(by.topRated.requiresApproval, true);
});

test("stored level drives the badge and the search filter", async () => {
  seller = await login("seller@example.com", "Seller123!");
  const set = await call("PATCH", `/admin/seller-levels/${seller.user.id}/override`, { token: admin.token, body: { tierId: "level2", reason: "test" } });
  assert.equal(set.status, 200, JSON.stringify(set.json));
  const lv = await call("GET", "/gig/mine/level", { token: seller.token });
  assert.equal(lv.status, 200);
  const found = await call("GET", "/gig?level=level2&limit=100");
  assert.equal(found.status, 200);
  const results = found.data.results;
  assert.ok(results.length > 0);
  assert.ok(results.every((g) => g.userId?.sellerLevel?.id === "level2" || !g.userId?.sellerLevel), "every result is a level 2 seller");
  assert.ok(results.some((g) => idOf(g.userId) === seller.user.id));
  const none = await call("GET", "/gig?level=topRated&limit=100");
  assert.ok(!none.data.results.some((g) => idOf(g.userId) === seller.user.id));
});

test("Top Rated approval is admin only", async () => {
  assert.equal((await call("POST", `/admin/seller-levels/${seller.user.id}/top-rated`, { token: seller.token, body: { action: "approve" } })).status, 403);
  const bad = await call("POST", `/admin/seller-levels/${seller.user.id}/top-rated`, { token: admin.token, body: { action: "maybe" } });
  assert.equal(bad.status, 400);
  const ok = await call("POST", `/admin/seller-levels/${seller.user.id}/top-rated`, { token: admin.token, body: { action: "approve" } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
});
