// Buyer service fee: percent of the payment plus a small-order fee under
// the threshold; quote and order agree; refunds include the fee.
const { test } = require("node:test");
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
const r2 = (n) => Math.round(n * 100) / 100;

test("quote adds the buyer service fee and small-order fee", async (t) => {
  const admin = await login("admin@example.com", "Admin123!");
  const m = (await call("GET", "/admin/settings/site", { token: admin.token })).data.site.marketplace;
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  const mine = (await call("GET", "/gig/mine/stats", { token: seller.token })).data.gigs.map((g) => g.id || g._id);
  const gig = (await call("GET", "/gig?limit=100")).data.results.find((g) => mine.includes(g.id || g._id));
  const pkg = gig.package[0];
  const q = await call("POST", "/orders/quote", { token: buyer.token, body: { gigId: gig.id || gig._id, packageName: pkg.name } });
  assert.equal(q.status, 200, JSON.stringify(q.json));
  const d = q.json.data?.attributes || q.json.data;
  const small = d.total < m.smallOrderUnder ? m.smallOrderFee : 0;
  assert.equal(d.serviceFee, r2(r2((d.charge * m.buyerFeePercent) / 100) + small));
  assert.equal(d.payable, r2(d.charge + d.serviceFee));

  const c = await call("POST", "/orders/checkout", { token: buyer.token, body: { gigId: gig.id || gig._id, packageName: pkg.name } });
  if (c.status === 503) return t.skip("payments not configured");
  const order = (await call("GET", `/orders/${c.json.orderId}`, { token: buyer.token })).data;
  assert.equal(order.escrow.serviceFee, d.serviceFee);
  assert.equal(order.escrow.amount, d.charge, "seller side unchanged");
});
