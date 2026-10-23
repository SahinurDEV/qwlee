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

test("proposal credits: offers cost a credit, closing without hiring refunds, packs are bought from balance", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  const web = (await call("GET", "/categories?limit=100")).data.results.find((c) => c.name === "Web Development");
  const start = (await call("GET", "/requests/credits/me", { token: seller.token })).data;
  assert.equal(start.enabled, true);
  assert.ok(start.total >= 1, JSON.stringify(start));
  const req = (await call("POST", "/requests", { token: buyer.token, body: { title: `Credits check ${Date.now()}`, description: "Need a quick landing page for a bakery opening.", budget: 100, deliveryDays: 5, categoriesId: web.id } })).data;
  const o = await call("POST", `/requests/${idOf(req)}/offers`, { token: seller.token, body: { price: 90, deliveryDays: 3, message: "Happy to help with this one." } });
  assert.equal(o.status, 201, JSON.stringify(o.json));
  const after = (await call("GET", "/requests/credits/me", { token: seller.token })).data;
  assert.equal(after.total, start.total - start.costPerOffer);
  assert.equal((await call("PATCH", `/requests/${idOf(req)}`, { token: buyer.token, body: { status: "closed" } })).status, 200);
  assert.equal((await call("GET", "/requests/credits/me", { token: seller.token })).data.total, start.total, "refunded on close");
  // A second close/reopen cycle never refunds twice.
  await call("PATCH", `/requests/${idOf(req)}`, { token: buyer.token, body: { status: "open" } });
  await call("PATCH", `/requests/${idOf(req)}`, { token: buyer.token, body: { status: "closed" } });
  assert.equal((await call("GET", "/requests/credits/me", { token: seller.token })).data.total, start.total);

  assert.equal((await call("POST", "/requests/credits/buy", { token: seller.token, body: { packs: 0 } })).status, 400);
  const b = await call("POST", "/requests/credits/buy", { token: seller.token, body: { packs: 1 } });
  assert.equal(b.status, 200, JSON.stringify(b.json));
  assert.equal(b.data.purchased, start.packSize);
  assert.equal(b.data.total, start.total + start.packSize);
  assert.equal(b.data.charged, start.packPrice);
});
