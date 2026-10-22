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

const balanceOf = async (s) => (await call("GET", `/users/${s.user.id}`, { token: s.token })).data.user.balance;

test("promoted gigs: paid from balance, sponsored in search, cancel refunds unused days", async () => {
  const cfg = (await call("GET", "/promotions/config")).data;
  assert.ok(cfg.dayPrice > 0 && cfg.maxDays >= 1);
  const seller = await login("seller@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const gig = await myPublicGig(seller.user.id);
  assert.ok(gig, "seller has an active gig");
  const gigId = idOf(gig);

  assert.equal((await call("POST", "/promotions", { token: seller.token, body: { gigId, days: 0 } })).status, 400);
  assert.equal((await call("POST", "/promotions", { token: seller.token, body: { gigId, days: 31 } })).status, 400);
  assert.equal((await call("POST", "/promotions", { token: buyer.token, body: { gigId, days: 1 } })).status, 404, "only the owner can promote");
  assert.equal((await call("POST", "/promotions", { token: seller.token, body: { gigId: "x", days: 1 } })).status, 400);

  // Start clean: a promotion left running would make this one "scheduled".
  for (const x of (await call("GET", "/promotions", { token: seller.token })).data.results) {
    if (x.status === "running" || x.status === "scheduled") await call("POST", `/promotions/${x.id}/cancel`, { token: seller.token });
  }
  const before = await balanceOf(seller);
  const cost = 3 * cfg.dayPrice;
  if (before < cost) {
    const r = await call("POST", "/promotions", { token: seller.token, body: { gigId, days: 3 } });
    assert.equal(r.status, 400, "insufficient balance is refused");
    assert.equal(await balanceOf(seller), before);
    return;
  }
  const made = await call("POST", "/promotions", { token: seller.token, body: { gigId, days: 3 } });
  assert.equal(made.status, 200);
  assert.equal(made.data.promotion.cost, cost);
  assert.equal(Math.round((before - (await balanceOf(seller))) * 100), Math.round(cost * 100));

  // Sponsored slot on page 1 of a matching search, not on page 2 or for lookups.
  const q = encodeURIComponent(gig.title.slice(0, 20));
  const res = (await call("GET", `/gig?title=${q}`)).data;
  assert.ok(res.promoted.some((g) => idOf(g) === gigId), "promoted gig shown as sponsored");
  assert.equal((await call("GET", `/gig?title=${q}&page=2`)).data.promoted, undefined);
  assert.equal((await call("GET", `/gig?title=zzzz-no-such-gig-${Date.now()}`)).data.promoted.length, 0);
  assert.equal((await call("POST", `/promotions/click/${gigId}`)).status, 200);

  const mine = (await call("GET", "/promotions", { token: seller.token })).data.results;
  const p = mine.find((x) => x.id === idOf(made.data.promotion));
  assert.equal(p.status, "running");
  assert.ok(p.impressions >= 1 && p.clicks >= 1);
  assert.equal((await call("GET", "/promotions", { token: buyer.token })).data.results.some((x) => x.id === p.id), false, "private to the seller");

  assert.equal((await call("POST", `/promotions/${p.id}/cancel`, { token: buyer.token })).status, 404);
  const c = await call("POST", `/promotions/${p.id}/cancel`, { token: seller.token });
  assert.equal(c.status, 200);
  assert.equal(c.data.refund, 2 * cfg.dayPrice, "two whole unused days refunded");
  assert.equal(Math.round((before - (await balanceOf(seller))) * 100), Math.round(cfg.dayPrice * 100));
  assert.equal((await call("POST", `/promotions/${p.id}/cancel`, { token: seller.token })).status, 404, "cannot refund twice");
  assert.equal((await call("GET", `/gig?title=${q}`)).data.promoted.some((g) => idOf(g) === gigId), false);
});
