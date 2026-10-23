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

test("talent search finds sellers; invited sellers see the request and offer without spending credits", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  const found = (await call("GET", `/talent?q=${encodeURIComponent(seller.user.fullName.slice(0, 5))}`)).data;
  assert.ok(found.results.some((u) => idOf(u) === idOf(seller.user)), "seller found by name");
  assert.ok(found.results.every((u) => u.role === "freelancer" && u.email === undefined && u.balance === undefined));
  assert.equal((await call("GET", "/talent?q=.*")).status, 200, "regex is escaped");
  const web = (await call("GET", "/categories?limit=100")).data.results.find((c) => c.name === "Web Development");
  const req = (await call("POST", "/requests", { token: buyer.token, body: { title: `Invite check ${Date.now()}`, description: "Need a quick landing page for a bakery opening.", budget: 100, deliveryDays: 5, categoriesId: web.id } })).data;
  const rid = idOf(req);
  assert.equal((await call("POST", `/requests/${rid}/invite`, { token: seller.token, body: { sellerId: idOf(seller.user) } })).status, 403, "only the owner invites");
  assert.equal((await call("POST", `/requests/${rid}/invite`, { token: buyer.token, body: { sellerId: idOf(buyer.user) } })).status, 400, "buyers can't be invited");
  assert.equal((await call("POST", `/requests/${rid}/invite`, { token: buyer.token, body: { sellerId: idOf(seller.user) } })).status, 201);
  assert.equal((await call("POST", `/requests/${rid}/invite`, { token: buyer.token, body: { sellerId: idOf(seller.user) } })).status, 409);
  const invites = (await call("GET", "/requests/invites/mine", { token: seller.token })).data;
  assert.ok(invites.some((r) => idOf(r) === rid));
  const before = (await call("GET", "/requests/credits/me", { token: seller.token })).data.total;
  const o = await call("POST", `/requests/${rid}/offers`, { token: seller.token, body: { price: 90, deliveryDays: 3, message: "Thanks for the invite, happy to help." } });
  assert.equal(o.status, 201, JSON.stringify(o.json));
  assert.equal((await call("GET", "/requests/credits/me", { token: seller.token })).data.total, before, "invited offers are free");
  await call("PATCH", `/requests/${rid}`, { token: buyer.token, body: { status: "closed" } });
});
