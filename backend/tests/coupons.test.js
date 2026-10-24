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

test("coupons: admin-only management, quote discount, one use per buyer, seller paid in full", async () => {
  const admin = await login("admin@example.com", "Admin123!");
  const mod = await login("moderator@example.com", "Admin123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  const code = `T${Date.now().toString(36).toUpperCase()}`;
  assert.equal((await call("POST", "/admin/coupons", { token: mod.token, body: { code, type: "percent", value: 10 } })).status, 403);
  assert.equal((await call("POST", "/admin/coupons", { token: buyer.token, body: { code, type: "percent", value: 10 } })).status, 403);
  assert.equal((await call("POST", "/admin/coupons", { token: admin.token, body: { code, type: "percent", value: 150 } })).status, 400);
  const c = await call("POST", "/admin/coupons", { token: admin.token, body: { code, type: "percent", value: 20, maxUses: 5 } });
  assert.equal(c.status, 201, JSON.stringify(c.json));
  assert.equal((await call("POST", "/admin/coupons", { token: admin.token, body: { code, type: "fixed", value: 5 } })).status, 409);

  const gig = (await call("GET", "/gig?limit=200")).data.results.find((g) => idOf(g.userId) === seller.user.id);
  const body = { gigId: idOf(gig), packageName: gig.package[0].name };
  assert.equal((await call("POST", "/orders/quote", { token: buyer.token, body: { ...body, couponCode: "NOPE-NOT-REAL" } })).status, 400);
  const q = await call("POST", "/orders/quote", { token: buyer.token, body: { ...body, couponCode: code.toLowerCase() } });
  assert.equal(q.status, 200, JSON.stringify(q.json));
  assert.equal(q.data.discount, Math.round(q.data.total * 20) / 100);
  assert.equal(q.data.charge, Math.round((q.data.total - q.data.discount) * 100) / 100);

  const co = await call("POST", "/orders/checkout", { token: buyer.token, body: { ...body, couponCode: code } });
  assert.ok(co.json?.orderId, JSON.stringify(co.json));
  const order = (await call("GET", `/orders/${co.json.orderId}`, { token: buyer.token })).data;
  assert.equal(order.escrow.amount, q.data.charge, "buyer charged the discounted price");
  assert.equal(order.escrow.platformFunded, q.data.discount);
  assert.equal((await call("POST", "/orders/quote", { token: buyer.token, body: { ...body, couponCode: code } })).status, 400, "one use per buyer");

  // Completing pays the seller on the full price.
  const fee = 5;
  const before = (await call("GET", `/users/${seller.user.id}`, { token: seller.token })).data.user.balance;
  const done = await call("POST", `/admin/orders/${co.json.orderId}/complete`, { token: admin.token });
  assert.equal(done.status, 200, JSON.stringify(done.json));
  const after = (await call("GET", `/users/${seller.user.id}`, { token: seller.token })).data.user.balance;
  assert.equal(Math.round((after - before) * 100) / 100, Math.round(q.data.total * (100 - fee)) / 100);

  const list = await call("GET", "/admin/coupons", { token: admin.token });
  const row = list.data.results.find((x) => x.code === code);
  assert.equal(row.uses, 1);
  assert.equal(row.discountGiven, q.data.discount);
  assert.equal((await call("PATCH", `/admin/coupons/${row.id}`, { token: admin.token, body: { active: false } })).data.active, false);
});

test("referrals: link, sign-up with ref creates the invitee's first-order coupon", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const admin = await login("admin@example.com", "Admin123!");
  const me = await call("GET", "/growth/referrals/me", { token: buyer.token });
  assert.equal(me.status, 200);
  assert.match(me.data.code, /^[a-f0-9]{8}$/);
  assert.ok(me.data.link.endsWith(`/sign-up?ref=${me.data.code}`));
  const before = (await call("GET", "/admin/coupons?source=referral", { token: admin.token })).data.results.length;
  const email = `ref${Date.now()}@example.com`;
  const r = await call("POST", "/auth/register", { body: { acceptTerms: true, email, password: "Passw0rd!x", fullName: "Ref Friend", ref: me.data.code } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const after = (await call("GET", "/admin/coupons?source=referral", { token: admin.token })).data.results;
  assert.equal(after.length, before + 1);
  assert.ok(after[0].code.startsWith("WELCOME") && after[0].firstOrderOnly);
  const again = await call("GET", "/growth/referrals/me", { token: buyer.token });
  assert.equal(again.data.invited, me.data.invited + 1);
});

test("welcome coupon: new accounts get one first-order code, referred accounts don't get a second", async () => {
  const admin = await login("admin@example.com", "Admin123!");
  const userId = async (email) => {
    const r = await call("GET", `/admin/users?search=${encodeURIComponent(email)}`, { token: admin.token });
    const u = (r.data.results || []).find((x) => x.email === email);
    return String(u?.id || u?._id);
  };
  const couponsFor = async (id) =>
    (await call("GET", "/admin/coupons?limit=100", { token: admin.token })).data.results.filter((c) => String(c.onlyUser) === id);

  const email = `hello${Date.now()}@example.com`;
  assert.equal((await call("POST", "/auth/register", { body: { acceptTerms: true, email, password: "Passw0rd!x", fullName: "New Buyer" } })).status, 201);
  const mine = await couponsFor(await userId(email));
  assert.equal(mine.length, 1);
  assert.equal(mine[0].source, "welcome");
  assert.ok(mine[0].code.startsWith("HELLO") && mine[0].firstOrderOnly);

  const buyer = await login("buyer@example.com", "Buyer123!");
  const ref = (await call("GET", "/growth/referrals/me", { token: buyer.token })).data.code;
  const email2 = `hello2${Date.now()}@example.com`;
  assert.equal((await call("POST", "/auth/register", { body: { acceptTerms: true, email: email2, password: "Passw0rd!x", fullName: "Ref Buyer", ref } })).status, 201);
  const theirs = await couponsFor(await userId(email2));
  assert.deepEqual(theirs.map((c) => c.source), ["referral"]);

  // Existing buyers with orders see no welcome offer.
  const w = await call("GET", "/growth/welcome/me", { token: buyer.token });
  assert.equal(w.status, 200);
  assert.equal(w.json.data.attributes, null);
});
