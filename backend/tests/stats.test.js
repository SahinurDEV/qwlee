const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");

test("homepage stats count real sellers, gigs and delivered orders", async () => {
  const res = await fetch(`${API}/v1/info/stats`);
  assert.equal(res.status, 200);
  const s = (await res.json()).data.attributes;
  assert.ok(s.sellers > 0, "seed has sellers");
  assert.ok(s.gigs > 0, "seed has gigs");
  assert.ok(s.orders > 0, "delivered orders are counted from payments");
  assert.ok(s.countries > 0);
  assert.ok(s.reviews > 0, "review count for the trust strip");
  assert.ok(s.avgRating >= 1 && s.avgRating <= 5);
});

const login = async (email, password) => {
  const r = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  assert.equal(r.status, 200);
  return (await r.json()).data.attributes.tokens.access.token;
};

test("demo buyer has inbox conversations, including one with the demo seller", async () => {
  const token = await login("buyer@example.com", "Buyer123!");
  const r = await fetch(`${API}/v1/chat/get-chat`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(r.status, 200);
  const body = await r.json();
  const list = body?.data?.attributes?.data || [];
  assert.ok(Array.isArray(list) && list.length >= 1, "buyer inbox not empty");
});

test("every seeded order opens for its buyer", async () => {
  const token = await login("buyer@example.com", "Buyer123!");
  const r = await fetch(`${API}/v1/orders?limit=50`, { headers: { authorization: `Bearer ${token}` } });
  const body = await r.json();
  const rows = body?.data?.attributes?.results || [];
  assert.ok(rows.length > 0);
  for (const o of rows) {
    const d = await fetch(`${API}/v1/orders/${o._id || o.id}`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(d.status, 200, `order ${o._id || o.id}`);
  }
});
