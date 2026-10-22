// Black-box API tests against a running, seeded stack.
//   API_URL=http://localhost:7171 node --test tests/
// Uses only Node's built-in test runner and fetch (Node 18+).
const { test, before } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const V1 = `${API}/v1`;

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${V1}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, json, data: json?.data?.attributes };
};

const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, `login ${email}`);
  return { token: r.data.tokens.access.token, user: r.data.user };
};

let buyer, seller, admin;
before(async () => {
  buyer = await login("buyer@example.com", "Buyer123!");
  seller = await login("seller@example.com", "Seller123!");
  admin = await login("admin@example.com", "Admin123!");
});

const PRIVATE = ["email", "oneTimeCode", "balance", "banReason", "verification", "levelOverride"];

test("public user directory hides private fields and non-sellers", async () => {
  const r = await call("GET", "/users?limit=100");
  assert.equal(r.status, 200);
  assert.ok(r.data.results.length > 0);
  for (const u of r.data.results) {
    for (const f of PRIVATE) assert.equal(u[f], undefined, `leaked ${f}`);
    assert.equal(u.role, "freelancer");
  }
});

test("public user directory cannot be searched by email or role", async () => {
  const r = await call("GET", "/users?email=admin&role=admin");
  assert.equal(r.status, 200);
  assert.ok(r.data.results.every((u) => u.role === "freelancer"));
});

test("admin still sees full user records", async () => {
  const r = await call("GET", "/users?limit=5", { token: admin.token });
  assert.equal(r.status, 200);
  assert.ok(r.data.results.some((u) => u.email));
  assert.ok(r.data.results.every((u) => u.oneTimeCode === undefined));
});

test("single user lookup is sanitised for strangers", async () => {
  const r = await call("GET", `/users/${seller.user.id}`);
  assert.equal(r.status, 200);
  for (const f of PRIVATE) assert.equal(r.data[f], undefined, `leaked ${f}`);
});

test("marketplace only lists active gigs and hides seller private data", async () => {
  const r = await call("GET", "/gig?limit=100");
  assert.equal(r.status, 200);
  assert.ok(r.data.results.length > 0);
  for (const g of r.data.results) {
    assert.equal(g.gigStatus, "active");
    for (const f of PRIVATE) assert.equal(g.userId?.[f], undefined, `seller leaked ${f}`);
  }
});

test("order details are only visible to the buyer and seller", async () => {
  const mine = await call("GET", "/orders?limit=1", { token: buyer.token });
  assert.equal(mine.status, 200);
  const order = mine.data.results[0];
  assert.ok(order, "seeded buyer has an order");
  const id = order.id || order._id;
  assert.equal((await call("GET", `/orders/${id}`, { token: buyer.token })).status, 200);
  const partyIds = [order.clientId?._id || order.clientId?.id || order.clientId, order.freelancerId?._id || order.freelancerId?.id || order.freelancerId].map(String);
  let stranger;
  for (const email of ["daniel.park@example.com", "priya.anand@example.com", "james.oconnor@example.com"]) {
    const s = await login(email, "Seller123!");
    if (!partyIds.includes(String(s.user.id))) { stranger = s; break; }
  }
  assert.ok(stranger, "found a non-party user");
  const t = stranger.token;
  assert.equal((await call("GET", `/orders/${id}`, { token: t })).status, 404);
  assert.equal((await call("PATCH", `/orders?orderId=${id}`, { token: t, body: { status: "delivered" } })).status, 403);
  assert.equal((await call("GET", `/order-message?orderId=${id}`, { token: t })).status, 404);
});

test("order updates reject mass assignment and seller self-acceptance", async () => {
  const r = await call("GET", "/orders/freelancer?limit=50", { token: seller.token });
  const open = r.data.results.find((o) => ["active", "late"].includes(o.status));
  if (!open) return; // nothing open in this dataset
  const id = open.id || open._id;
  const self = await call("PATCH", `/orders?orderId=${id}`, { token: seller.token, body: { status: "delivered" } });
  assert.equal(self.status, 403);
  const mass = await call("PATCH", `/orders?orderId=${id}`, { token: seller.token, body: { price: 1 } });
  assert.equal(mass.status, 400);
});

test("seed images are served by the API", async () => {
  const res = await fetch(`${API}/seed/gig/01.jpg`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /image\/jpeg/);
});
