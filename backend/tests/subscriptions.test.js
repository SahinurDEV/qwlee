const { test } = require("node:test");
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
const idOf = (v) => String(v?.id || v?._id || v || "");
const myPublicGig = async (sellerId) =>
  (await call("GET", "/gig?limit=200")).data.results.find((g) => idOf(g.userId) === String(sellerId));


test("subscriptions: seller opt-in, monthly orders at a discount, pause/resume/cancel", async (t) => {
  const seller = await login("seller@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const admin = await login("admin@example.com", "Admin123!");
  const fin = await login("finance@example.com", "Admin123!");
  const gig = await myPublicGig(seller.user.id);
  const gigId = idOf(gig);
  const pkg = gig.package[0];

  assert.equal((await call("PUT", `/subscriptions/gig/${gigId}`, { token: buyer.token, body: { enabled: true } })).status, 404, "only the owner");
  assert.equal((await call("PUT", `/subscriptions/gig/${gigId}`, { token: seller.token, body: { enabled: true, discountPercent: 50 } })).status, 400);
  await call("PUT", `/subscriptions/gig/${gigId}`, { token: seller.token, body: { enabled: false } });
  assert.equal((await call("POST", "/subscriptions", { token: buyer.token, body: { gigId, packageName: pkg.name } })).status, 400, "not offered");
  assert.equal((await call("PUT", `/subscriptions/gig/${gigId}`, { token: seller.token, body: { enabled: true, discountPercent: 10 } })).status, 200);

  const s = await call("POST", "/subscriptions", { token: buyer.token, body: { gigId, packageName: pkg.name } });
  if (s.status === 503) return t.skip("demo payments off");
  assert.equal(s.status, 200, JSON.stringify(s.json));
  const sub = s.data.subscription;
  const expected = Math.round(pkg.price * 0.9 * 100) / 100;
  assert.equal(sub.price, expected);
  const first = (await call("GET", `/orders/${s.data.orderId}`, { token: buyer.token })).data;
  assert.equal(first.price, expected, "first month ordered at the discounted price");
  assert.equal(first.escrow.status, "held");
  assert.equal((await call("POST", "/subscriptions", { token: buyer.token, body: { gigId, packageName: pkg.name } })).status, 409, "no duplicates");
  assert.equal((await call("POST", "/subscriptions", { token: seller.token, body: { gigId, packageName: pkg.name } })).status, 400, "not your own gig");

  // Next month: billing creates the second order.
  const nextMonth = new Date(new Date(sub.nextBillingAt).getTime() + 60000).toISOString();
  assert.equal((await call("POST", "/admin/jobs/subscriptions", { token: fin.token, body: { asOf: nextMonth } })).status, 403);
  const run = await call("POST", "/admin/jobs/subscriptions", { token: admin.token, body: { asOf: nextMonth } });
  assert.equal(run.status, 200);
  assert.ok(run.data.paid >= 1);
  let mine = (await call("GET", "/subscriptions", { token: buyer.token })).data.results.find((x) => x.id === sub.id);
  assert.equal(mine.cycles.filter((c) => c.status === "paid").length, 2);
  assert.ok(new Date(mine.nextBillingAt) > new Date(nextMonth), "advanced a month");
  const sellerView = (await call("GET", "/subscriptions?role=seller", { token: seller.token })).data.results.find((x) => x.id === sub.id);
  assert.equal(sellerView.buyer.username, buyer.user.username);
  assert.equal(sellerView.buyer.email, undefined);

  // Paused subscriptions are not billed.
  assert.equal((await call("PATCH", `/subscriptions/${sub.id}`, { token: seller.token, body: { action: "pause" } })).status, 400, "only the buyer pauses");
  assert.equal((await call("PATCH", `/subscriptions/${sub.id}`, { token: buyer.token, body: { action: "pause" } })).data.status, "paused");
  const later = new Date(new Date(mine.nextBillingAt).getTime() + 60000).toISOString();
  await call("POST", "/admin/jobs/subscriptions", { token: admin.token, body: { asOf: later } });
  mine = (await call("GET", "/subscriptions", { token: buyer.token })).data.results.find((x) => x.id === sub.id);
  assert.equal(mine.cycles.length, 2);
  assert.equal((await call("PATCH", `/subscriptions/${sub.id}`, { token: buyer.token, body: { action: "resume" } })).data.status, "active");
  assert.equal((await call("PATCH", `/subscriptions/${sub.id}`, { token: seller.token, body: { action: "cancel" } })).data.status, "cancelled", "either side cancels");
  assert.equal((await call("PATCH", `/subscriptions/${sub.id}`, { token: buyer.token, body: { action: "resume" } })).status, 409);
  await call("PUT", `/subscriptions/gig/${gigId}`, { token: seller.token, body: { enabled: false } });
});
