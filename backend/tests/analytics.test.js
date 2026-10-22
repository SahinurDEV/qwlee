const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const login = async (email, password) => {
  const r = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  return (j.data?.attributes ?? j.data).tokens.access.token;
};
const get = async (path, token) => {
  const r = await fetch(`${API}/v1${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const j = await r.json().catch(() => null);
  return { status: r.status, data: j?.data?.attributes };
};

test("seller analytics: sellers only, consistent totals and per-gig funnel", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  assert.equal((await get("/analytics/seller")).status, 401);
  assert.equal((await get("/analytics/seller", buyer)).status, 403);
  const r = await get("/analytics/seller?days=365", seller);
  assert.equal(r.status, 200);
  const t = r.data.totals;
  assert.ok(t.orders >= t.completed + t.cancelled);
  assert.ok(t.cancellationRate >= 0 && t.cancellationRate <= 100);
  const sum = Math.round(r.data.series.reduce((n, s) => n + s.earnings, 0) * 100) / 100;
  assert.ok(Math.abs(sum - t.earnings) < 0.05, "series adds up to the total");
  assert.ok(r.data.gigs.length > 0);
  for (const g of r.data.gigs) assert.ok(g.ctr >= 0 && g.ctr <= 100 || g.impressions === 0);
  assert.equal((await get("/analytics/seller?days=999", seller)).data.range, 30, "unknown range falls back");
});
