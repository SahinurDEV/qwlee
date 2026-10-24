// Order lifecycle: server-side pricing, escrow, requirements, delivery,
// revisions, acceptance, cancellation, plus gig ownership checks.
// Needs a seeded stack with DEMO_PAYMENTS=true (the compose default).
const { test, before } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const V1 = `${API}/v1`;

const call = async (method, path, { token, body, form } = {}) => {
  const res = await fetch(`${V1}${path}`, {
    method,
    headers: {
      ...(form ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
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
const balanceOf = async (u) => (await call("GET", `/users/${u.user.id}`, { token: u.token })).data.user.balance;

let buyer, seller, otherSeller, gig;
before(async () => {
  buyer = await login("buyer@example.com", "Buyer123!");
  seller = await login("seller@example.com", "Seller123!");
  otherSeller = await login("daniel.park@example.com", "Seller123!");
  const r = await call("GET", "/gig/mine/stats", { token: seller.token });
  const mine = r.data.gigs.map((g) => g.id || g._id);
  const list = await call("GET", "/gig?limit=100");
  gig = list.data.results.find((g) => mine.includes(g.id || g._id) && (g.extras || []).length > 0);
  assert.ok(gig, "seller has an active gig with extras");
});

const checkout = async (extra = {}) => {
  const pkg = gig.package[1] || gig.package[0];
  const r = await call("POST", "/orders/checkout", {
    token: buyer.token,
    body: { gigId: gig.id || gig._id, packageName: pkg.name, extraIds: [gig.extras[0]._id], price: 1, items: [{ name: "x", price: 1, quantity: 1 }], ...extra },
  });
  return { r, pkg };
};

test("checkout prices on the server and holds the money in escrow", async (t) => {
  const { r, pkg } = await checkout();
  if (r.status === 503) return t.skip("payments not configured (set DEMO_PAYMENTS=true)");
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.provider, "demo");
  const order = (await call("GET", `/orders/${r.json.orderId}`, { token: buyer.token })).data;
  const expected = Number(pkg.price) + Number(gig.extras[0].price);
  assert.equal(order.price, expected, "client-sent price is ignored");
  assert.equal(order.escrow.status, "held");
  assert.equal(order.escrow.amount, expected);
  assert.equal(order.requirementsStatus, "pending");
});

test("quote matches checkout and rejects unknown extras", async () => {
  const pkg = gig.package[0];
  const q = await call("POST", "/orders/quote", { token: buyer.token, body: { gigId: gig.id || gig._id, packageName: pkg.name } });
  assert.equal(q.status, 200);
  assert.equal(q.data.total, Number(pkg.price));
  const bad = await call("POST", "/orders/quote", { token: buyer.token, body: { gigId: gig.id || gig._id, packageName: pkg.name, extraIds: ["000000000000000000000000"] } });
  assert.equal(bad.status, 400);
  const anon = await call("POST", "/orders/checkout", { body: { gigId: gig.id || gig._id } });
  assert.equal(anon.status, 401);
});

test("full lifecycle: requirements, delivery, revision, accept, single payout", async (t) => {
  const { r } = await checkout();
  if (r.status === 503) return t.skip("payments not configured");
  const id = r.json.orderId;

  // Requirements: seller cannot submit; buyer must answer required ones.
  assert.equal((await call("POST", `/orders/${id}/requirements`, { token: seller.token, body: { answers: [] } })).status, 403);
  assert.equal((await call("POST", `/orders/${id}/requirements`, { token: buyer.token, body: { answers: [] } })).status, 400);
  const req = await call("POST", `/orders/${id}/requirements`, {
    token: buyer.token,
    body: { answers: [{ question: "q1", answer: "A landing page for my bakery" }, { question: "q2", answer: "" }] },
  });
  assert.equal(req.status, 200, JSON.stringify(req.json));
  assert.equal(req.data.requirementsStatus, "submitted");

  // Ask for an update: buyer only, one open at a time; seller answers.
  assert.equal((await call("POST", `/orders/${id}/update-request`, { token: seller.token, body: {} })).status, 403);
  const up = await call("POST", `/orders/${id}/update-request`, { token: buyer.token, body: { note: "How is it going?" } });
  assert.equal(up.status, 200, JSON.stringify(up.json));
  assert.equal(up.data.updateRequest.status, "pending");
  assert.equal((await call("POST", `/orders/${id}/update-request`, { token: buyer.token, body: {} })).status, 409);
  const ans = await call("PATCH", `/orders/${id}/update-request`, { token: seller.token, body: { reply: "Halfway there, delivering tomorrow" } });
  assert.equal(ans.status, 200, JSON.stringify(ans.json));
  assert.equal(ans.data.updateRequest.status, "answered");
  // A pending cancellation blocks a second kind of request.
  assert.equal((await call("POST", `/orders/${id}/cancellation`, { token: buyer.token, body: { reason: "Changed my mind" } })).status, 200);
  const blocked = await call("POST", `/orders/${id}/update-request`, { token: buyer.token, body: {} });
  assert.equal(blocked.status, 409);
  assert.equal((await call("PATCH", `/orders/${id}/cancellation`, { token: buyer.token, body: { action: "withdraw" } })).status, 200);

  // Only the seller can deliver.
  const deliver = async (u) => {
    const form = new FormData();
    form.append("orderId", id);
    form.append("deliveryMessage", "Here is the work");
    form.append("receiver", u === seller ? buyer.user.id : seller.user.id);
    return call("POST", "/order-message", { token: u.token, form });
  };
  assert.equal((await deliver(buyer)).status, 403);
  assert.equal((await deliver(seller)).status, 201);
  let order = (await call("GET", `/orders/${id}`, { token: buyer.token })).data;
  assert.equal(order.delivery.state, "submitted");
  assert.ok(order.delivery.autoCompleteAt);
  const revisionsBefore = order.data.revisionsLeft;

  // Revision round.
  const rev = await call("POST", `/orders/${id}/revision`, { token: buyer.token, body: { reason: "Bigger logo" } });
  assert.equal(rev.status, 200, JSON.stringify(rev.json));
  assert.equal(rev.data.data.revisionsLeft, revisionsBefore - 1);
  assert.equal(rev.data.delivery.state, "revision");
  assert.equal((await call("POST", `/orders/${id}/revision`, { token: buyer.token, body: {} })).status, 409);
  assert.equal((await deliver(seller)).status, 201);

  // Seller cannot accept their own work; buyer accepts once.
  assert.equal((await call("POST", `/orders/${id}/accept`, { token: seller.token })).status, 403);
  const before = await balanceOf(seller);
  const acc = await call("POST", `/orders/${id}/accept`, { token: buyer.token });
  assert.equal(acc.status, 200, JSON.stringify(acc.json));
  assert.equal(acc.data.status, "delivered");
  assert.equal(acc.data.escrow.status, "released");
  const fee = acc.data.platformFeePercent;
  const net = Math.round(acc.data.escrow.amount * (100 - fee)) / 100;
  assert.equal(acc.data.sellerEarning, net);
  assert.equal(Math.round(((await balanceOf(seller)) - before) * 100) / 100, net);

  // Second accept (either route) must not pay again.
  assert.equal((await call("POST", `/orders/${id}/accept`, { token: buyer.token })).status, 409);
  assert.equal((await call("PATCH", `/orders?orderId=${id}`, { token: buyer.token, body: { status: "delivered" } })).status, 409);
  assert.equal(Math.round(((await balanceOf(seller)) - before) * 100) / 100, net);
});

test("cancelling an open order refunds the escrow", async (t) => {
  const { r } = await checkout();
  if (r.status === 503) return t.skip("payments not configured");
  const id = r.json.orderId;
  // A buyer can't cancel an on-time order alone; the seller can.
  assert.equal((await call("PATCH", `/orders?orderId=${id}`, { token: buyer.token, body: { status: "cancelled", reason: "Changed my mind", _mutual: true } })).status, 409);
  const c = await call("PATCH", `/orders?orderId=${id}`, { token: seller.token, body: { status: "cancelled", reason: "Can't do it" } });
  assert.equal(c.status, 201, JSON.stringify(c.json));
  const order = (await call("GET", `/orders/${id}`, { token: buyer.token })).data;
  assert.equal(order.status, "cancelled");
  assert.equal(order.escrow.status, "refunded");
  assert.equal(order.escrow.refund.amount, Math.round((order.escrow.amount + (order.escrow.serviceFee || 0)) * 100) / 100, "the full payment, service fee included, is refunded");
});

test("sellers can only edit their own gigs, and cannot bypass moderation", async () => {
  const gid = gig.id || gig._id;
  assert.equal((await call("PATCH", `/gig/${gid}`, { token: otherSeller.token, body: { title: "pwned" } })).status, 403);
  assert.equal((await call("DELETE", `/gig/${gid}`, { token: otherSeller.token })).status, 403);
  const mine = await call("GET", "/gig/mine/stats", { token: seller.token });
  const pending = mine.data.gigs.find((g) => g.gigStatus === "pending" || g.gigStatus === "requires-modification");
  if (pending) {
    const r = await call("PATCH", `/gig/${pending.id || pending._id}`, { token: seller.token, body: { gigStatus: "active" } });
    assert.equal(r.status, 403);
  }
});

test("gig descriptions are sanitised and extras/FAQ/requirements validated", async () => {
  const gid = gig.id || gig._id;
  const r = await call("PATCH", `/gig/${gid}`, {
    token: seller.token,
    body: {
      description: '<p onclick="alert(1)">Hello</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
      faq: [{ question: "Q?", answer: "A." }],
      extras: gig.extras,
      requirementQuestions: [{ question: "Describe your project and its goal.", required: true }, { question: "Links?", required: false }],
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const desc = r.data.description;
  assert.ok(!/script|onclick|javascript:/i.test(desc), desc);
  assert.match(desc, /Hello/);
  const bad = await call("PATCH", `/gig/${gid}`, { token: seller.token, body: { extras: [{ title: "", price: -1 }] } });
  assert.equal(bad.status, 400);
  const badVideo = await call("PATCH", `/gig/${gid}`, { token: seller.token, body: { video: "javascript:alert(1)" } });
  assert.equal(badVideo.status, 400);
});

test("mutual cancellation: request, only the other side answers, accept refunds", async (t) => {
  const { r } = await checkout();
  if (r.status === 503) return t.skip("payments not configured");
  const id = r.json.orderId;
  assert.equal((await call("POST", `/orders/${id}/cancellation`, { token: buyer.token, body: { reason: "x" } })).status, 400, "reason required");
  const q = await call("POST", `/orders/${id}/cancellation`, { token: buyer.token, body: { reason: "Plans changed, sorry" } });
  assert.equal(q.status, 200, JSON.stringify(q.json));
  assert.equal(q.data.cancellationRequest.status, "pending");
  assert.equal((await call("POST", `/orders/${id}/cancellation`, { token: buyer.token, body: { reason: "Again please" } })).status, 409, "one open request");
  assert.equal((await call("PATCH", `/orders/${id}/cancellation`, { token: buyer.token, body: { action: "accept" } })).status, 403, "requester can't accept");
  const d = await call("PATCH", `/orders/${id}/cancellation`, { token: seller.token, body: { action: "decline" } });
  assert.equal(d.data.cancellationRequest.status, "declined");
  assert.equal(d.data.status, "active");
  await call("POST", `/orders/${id}/cancellation`, { token: seller.token, body: { reason: "I am unavailable" } });
  const a = await call("PATCH", `/orders/${id}/cancellation`, { token: buyer.token, body: { action: "accept" } });
  assert.equal(a.status, 200, JSON.stringify(a.json));
  assert.equal(a.data.status, "cancelled");
  assert.equal(a.data.escrow.status, "refunded");
});
