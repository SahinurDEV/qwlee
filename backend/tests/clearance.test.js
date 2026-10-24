// Clearance period: earnings from a completed order wait in
// pendingBalance until the clearance days pass (admin setting).
const { test, after } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body, form } = {}) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: { ...(form ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data?.attributes };
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, `login ${email}`);
  return { token: r.data.tokens.access.token, user: r.data.user };
};
const me = async (u) => (await call("GET", `/users/${u.user.id}`, { token: u.token })).data.user;

let admin, prev;
after(async () => {
  if (admin) await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { clearanceDays: prev ?? 0 } } });
});

test("completed order earnings wait for clearance", async (t) => {
  admin = await login("admin@example.com", "Admin123!");
  const site = await call("GET", "/admin/settings/site", { token: admin.token });
  prev = site.data.site.marketplace.clearanceDays;
  const set = await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { clearanceDays: 14, clearanceDaysFast: 7 } } });
  assert.equal(set.status, 200, JSON.stringify(set.json));

  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  const mine = (await call("GET", "/gig/mine/stats", { token: seller.token })).data.gigs.map((g) => g.id || g._id);
  const gig = (await call("GET", "/gig?limit=100")).data.results.find((g) => mine.includes(g.id || g._id));
  const pkg = gig.package[0];
  const r = await call("POST", "/orders/checkout", { token: buyer.token, body: { gigId: gig.id || gig._id, packageName: pkg.name, price: 1, items: [{ name: "x", price: 1, quantity: 1 }] } });
  if (r.status === 503) return t.skip("payments not configured");
  const id = r.json.orderId;
  await call("POST", `/orders/${id}/requirements`, { token: buyer.token, body: { answers: [{ question: "q1", answer: "A landing page for my bakery" }, { question: "q2", answer: "" }] } });
  const form = new FormData();
  form.append("orderId", id);
  form.append("deliveryMessage", "Done");
  form.append("receiver", buyer.user.id);
  assert.equal((await call("POST", "/order-message", { token: seller.token, form })).status, 201);

  const before = await me(seller);
  const acc = await call("POST", `/orders/${id}/accept`, { token: buyer.token });
  assert.equal(acc.status, 200, JSON.stringify(acc.json));
  const net = acc.data.sellerEarning;
  const afterU = await me(seller);
  assert.equal(afterU.balance, before.balance, "balance unchanged until cleared");
  assert.equal(Math.round(((afterU.pendingBalance || 0) - (before.pendingBalance || 0)) * 100) / 100, net);

  const c = await call("GET", "/withdrawal/clearance", { token: seller.token });
  assert.equal(c.status, 200);
  const row = c.data.next.find((x) => x.ref === String(id));
  assert.ok(row, "clearance row for the order");
  const days = (new Date(row.availableAt) - Date.now()) / 86400000;
  assert.ok(days > 6 && days <= 14.01, `clears in ${days} days`);
});
