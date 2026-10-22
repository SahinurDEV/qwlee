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

test("buyer request -> seller offer -> buyer hires through escrow checkout", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  const cats = (await call("GET", "/categories?limit=100")).data.results;
  const web = cats.find((c) => c.name === "Web Development");

  // Validation
  assert.equal((await call("POST", "/requests", { body: { title: "x" } })).status, 401);
  assert.equal((await call("POST", "/requests", { token: buyer.token, body: { title: "short", description: "too short", budget: 1, deliveryDays: 0 } })).status, 400);

  const created = await call("POST", "/requests", {
    token: buyer.token,
    body: { title: `Build a booking widget ${Date.now()}`, description: "<b>Need</b> a booking widget for my salon website with reminders.", budget: 200, deliveryDays: 5, categoriesId: web.id },
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const req = created.json.data.attributes || created.json.data;
  assert.ok(!req.description.includes("<b>"), "HTML stripped");

  // Public board shows it; the buyer's own board view hides it.
  const board = await call("GET", `/requests?category=${web.id}&limit=100`);
  assert.ok(board.data.results.some((r) => idOf(r) === idOf(req)));
  for (const r of board.data.results) assert.equal(r.buyerId.email, undefined, "buyer email not leaked");
  const own = await call("GET", "/requests?limit=100", { token: buyer.token });
  assert.ok(!own.data.results.some((r) => idOf(r) === idOf(req)));

  // Buyers (non-sellers) cannot offer; the seller can, once.
  assert.equal((await call("POST", `/requests/${idOf(req)}/offers`, { token: buyer.token, body: { price: 150, deliveryDays: 4, message: "I can do it fast" } })).status, 403);
  const offerRes = await call("POST", `/requests/${idOf(req)}/offers`, { token: seller.token, body: { price: 180, deliveryDays: 4, revisions: 2, message: "I build these all the time." } });
  assert.equal(offerRes.status, 201, JSON.stringify(offerRes.json));
  const offer = offerRes.json.data.attributes || offerRes.json.data;
  assert.equal((await call("POST", `/requests/${idOf(req)}/offers`, { token: seller.token, body: { price: 100, deliveryDays: 4, message: "Second try here" } })).status, 409);

  // Only the owner sees all offers.
  const ownerView = await call("GET", `/requests/${idOf(req)}`, { token: buyer.token });
  assert.equal(ownerView.data.isOwner, true);
  assert.equal(ownerView.data.offers.length, 1);
  assert.equal(ownerView.data.offers[0].sellerId.email, undefined);
  const anon = await call("GET", `/requests/${idOf(req)}`);
  assert.equal(anon.data.offers.length, 0);

  // Seller can't hire themselves; price comes from the stored offer.
  assert.equal((await call("POST", "/orders/quote", { token: seller.token, body: { requestOfferId: idOf(offer) } })).status, 403);
  const quote = await call("POST", "/orders/quote", { token: buyer.token, body: { requestOfferId: idOf(offer), price: 1 } });
  assert.equal(quote.status, 200, JSON.stringify(quote.json));
  assert.equal((quote.data.quote || quote.data).total, 180);

  const checkout = await fetch(`${API}/v1/orders/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({ requestOfferId: idOf(offer) }),
  }).then((r) => r.json());
  assert.ok(checkout.orderId, JSON.stringify(checkout));
  const order = (await call("GET", `/orders/${checkout.orderId}`, { token: buyer.token })).data;
  assert.equal(order.price, 180);
  assert.equal(order.escrow.status, "held");
  assert.equal(idOf(order.freelancerId), idOf(seller.user));
  assert.equal(order.requirementsStatus, "not_required");

  const after = await call("GET", `/requests/${idOf(req)}`, { token: buyer.token });
  assert.equal(after.data.request.status, "hired");
  assert.equal(after.data.offers[0].status, "accepted");
  // Offer can't be bought twice.
  assert.equal((await call("POST", "/orders/quote", { token: buyer.token, body: { requestOfferId: idOf(offer) } })).status, 409);
  // Closed to new offers.
  const seller2 = await login("james.oconnor@example.com", "Seller123!").catch(() => null);
  if (seller2) {
    assert.equal((await call("POST", `/requests/${idOf(req)}/offers`, { token: seller2.token, body: { price: 100, deliveryDays: 3, message: "Late offer here" } })).status, 400);
  }
});

test("request owner controls: decline, close, others cannot edit", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  const r = (await call("POST", "/requests", { token: buyer.token, body: { title: `Write ten blog posts ${Date.now()}`, description: "Ten SEO blog posts about home gardening, 1000 words each.", budget: 300, deliveryDays: 10 } })).data;
  const o = (await call("POST", `/requests/${idOf(r)}/offers`, { token: seller.token, body: { price: 280, deliveryDays: 9, message: "Gardening is my niche." } })).data;
  assert.equal((await call("POST", `/requests/offers/${idOf(o)}/decline`, { token: seller.token })).status, 403);
  assert.equal((await call("POST", `/requests/offers/${idOf(o)}/decline`, { token: buyer.token })).status, 200);
  assert.equal((await call("POST", "/orders/quote", { token: buyer.token, body: { requestOfferId: idOf(o) } })).status, 409);
  assert.equal((await call("PATCH", `/requests/${idOf(r)}`, { token: seller.token, body: { budget: 1000 } })).status, 403);
  assert.equal((await call("PATCH", `/requests/${idOf(r)}`, { token: buyer.token, body: { status: "closed" } })).status, 200);
  const board = await call("GET", "/requests?limit=100");
  assert.ok(!board.data.results.some((x) => idOf(x) === idOf(r)), "closed requests leave the board");
  const mine = await call("GET", "/requests/mine", { token: buyer.token });
  assert.ok(mine.data.results.some((x) => idOf(x) === idOf(r)));
  const myOffers = await call("GET", "/requests/offers/mine", { token: seller.token });
  assert.ok(myOffers.data.results.some((x) => idOf(x) === idOf(o)));
});
