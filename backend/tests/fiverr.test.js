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

test("profile update cannot escalate role, balance or ban state", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const r = await call("POST", "/users/profile", { token: buyer.token, body: { role: "admin", balance: 99999, isBan: false, isEmailVerified: true, intro: "Hello there" } });
  assert.equal(r.status, 200);
  const me = (await call("GET", `/users/${buyer.user.id}`, { token: buyer.token })).data.user;
  assert.equal(me.role, "buyer");
  assert.notEqual(me.balance, 99999);
  assert.equal(me.intro, "Hello there");
});

test("gig tags: validated, searchable", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const gig = await myPublicGig(seller.user.id);
  const bad = await call("PATCH", `/gig/${idOf(gig)}`, { token: seller.token, body: { tags: ["a", "b", "c", "d", "e", "f"] } });
  assert.equal(bad.status, 400);
  const tag = `zebratag${Date.now() % 100000}`;
  const ok = await call("PATCH", `/gig/${idOf(gig)}`, { token: seller.token, body: { tags: [tag, "Next.js"] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  const found = await call("GET", `/gig?title=${tag}`);
  assert.ok(found.data.results.some((g) => idOf(g) === idOf(gig)), "tag search finds the gig");
  assert.ok(found.data.results.every((g) => (g.tags || []).includes(tag) || g.title.toLowerCase().includes(tag)));
});

test("vacation mode hides gigs from search and blocks new orders", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const gig = await myPublicGig(seller.user.id);
  const bad = await call("POST", "/users/profile", { token: seller.token, body: { availability: { away: true, from: "2030-01-02", until: "2030-01-01" } } });
  assert.equal(bad.status, 400);
  const until = new Date(Date.now() + 3 * 86400000).toISOString();
  assert.equal((await call("POST", "/users/profile", { token: seller.token, body: { availability: { away: true, until, message: "Back soon" } } })).status, 200);
  try {
    const list = await call("GET", "/gig?limit=200");
    assert.ok(!list.data.results.some((g) => idOf(g.userId) === String(seller.user.id)), "away seller hidden from search");
    const quote = await call("POST", "/orders/quote", { token: buyer.token, body: { gigId: idOf(gig), packageName: gig.package[0].name } });
    assert.equal(quote.status, 409);
    const pub = (await call("GET", `/users/${seller.user.id}`)).data.user;
    assert.equal(pub.availability.away, true);
    assert.equal(pub.availability.message, "Back soon");
  } finally {
    await call("POST", "/users/profile", { token: seller.token, body: { availability: { away: false } } });
  }
  const back = await call("POST", "/orders/quote", { token: buyer.token, body: { gigId: idOf(gig), packageName: gig.package[0].name } });
  assert.equal(back.status, 200);
});

test("tips: only on completed orders, limits enforced, credited to seller", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const gig = await myPublicGig(seller.user.id);
  const co = await fetch(`${API}/v1/orders/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({ gigId: idOf(gig), packageName: gig.package[0].name }),
  }).then((r) => r.json());
  assert.ok(co.orderId, JSON.stringify(co));
  assert.equal((await call("POST", `/orders/${co.orderId}/tip`, { token: buyer.token, body: { amount: 10 } })).status, 400, "not completed yet");
  // Complete it: deliver, then accept.
  const order = (await call("GET", `/orders/${co.orderId}`, { token: buyer.token })).data;
  if (order.requirementsStatus === "pending") {
    const answers = order.data.requirementQuestions.map((q) => ({ question: q.question, answer: "Details here" }));
    await call("POST", `/orders/${co.orderId}/requirements`, { token: buyer.token, body: { answers } });
  }
  const f = new FormData();
  f.append("orderId", co.orderId);
  f.append("deliveryMessage", "Here you go");
  f.append("receiver", buyer.user.id);
  await fetch(`${API}/v1/order-message`, { method: "POST", headers: { authorization: `Bearer ${seller.token}` }, body: f });
  assert.equal((await call("POST", `/orders/${co.orderId}/accept`, { token: buyer.token })).status, 200);

  const before = (await call("GET", `/users/${seller.user.id}`, { token: seller.token })).data.user.balance;
  assert.equal((await call("POST", `/orders/${co.orderId}/tip`, { token: seller.token, body: { amount: 10 } })).status, 403);
  assert.equal((await call("POST", `/orders/${co.orderId}/tip`, { token: buyer.token, body: { amount: 2 } })).status, 400);
  assert.equal((await call("POST", `/orders/${co.orderId}/tip`, { token: buyer.token, body: { amount: 1e6 } })).status, 400);
  const tip = await fetch(`${API}/v1/orders/${co.orderId}/tip`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${buyer.token}` },
    body: JSON.stringify({ amount: 20 }),
  });
  assert.equal(tip.status, 200);
  const after = (await call("GET", `/users/${seller.user.id}`, { token: seller.token })).data.user.balance;
  assert.equal(Math.round((after - before) * 100) / 100, 19, "tip credited net of 5% fee");
  const o2 = (await call("GET", `/orders/${co.orderId}`, { token: buyer.token })).data;
  assert.equal(o2.tips.length, 1);

  // Admin returns the tip: seller's net share comes back off, once only.
  const admin = await login("admin@example.com", "Admin123!");
  const tipId = encodeURIComponent(o2.tips[0].sessionId);
  const rf = await call("POST", `/admin/orders/${co.orderId}/tips/${tipId}/refund`, { token: admin.token, body: { reason: "test" } });
  assert.equal(rf.status, 200, JSON.stringify(rf.json));
  assert.equal(rf.data.refund.status, "succeeded");
  const back = (await call("GET", `/users/${seller.user.id}`, { token: seller.token })).data.user.balance;
  assert.equal(Math.round((back - before) * 100) / 100, 0, "seller debited the tip's net share");
  assert.equal((await call("POST", `/admin/orders/${co.orderId}/tips/${tipId}/refund`, { token: admin.token })).status, 409);
  assert.equal((await call("POST", `/admin/orders/${co.orderId}/tips/${tipId}/refund`, { token: seller.token })).status, 403);
});
