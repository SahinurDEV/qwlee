// Two-way, double-blind reviews: the seller's review of the buyer stays
// hidden from the buyer until the buyer reviews the order too.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body, form } = {}) => {
  const res = await fetch(`${API}/v1${path}`, { method, headers: { ...(form ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: form || (body ? JSON.stringify(body) : undefined) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data?.attributes };
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200);
  return { token: r.data.tokens.access.token, user: r.data.user };
};

test("seller review of the buyer is double-blind", async (t) => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  const mine = (await call("GET", "/gig/mine/stats", { token: seller.token })).data.gigs.map((g) => g.id || g._id);
  const gig = (await call("GET", "/gig?limit=100")).data.results.find((g) => mine.includes(g.id || g._id));
  const pkg = gig.package[0];
  const r = await call("POST", "/orders/checkout", { token: buyer.token, body: { gigId: gig.id || gig._id, packageName: pkg.name } });
  if (r.status === 503) return t.skip("payments not configured");
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const id = r.json.orderId;
  const order = (await call("GET", `/orders/${id}`, { token: buyer.token })).data;
  if (order.requirementsStatus === "pending") {
    const qs = (gig.requirements || []).map((q) => ({ question: q.question, answer: "Answer for the test" }));
    await call("POST", `/orders/${id}/requirements`, { token: buyer.token, body: { answers: qs } });
  }
  const form = new FormData();
  form.append("orderId", id);
  form.append("deliveryMessage", "Done");
  form.append("receiver", buyer.user.id);
  assert.equal((await call("POST", "/order-message", { token: seller.token, form })).status, 201);
  assert.equal((await call("POST", `/orders/${id}/accept`, { token: buyer.token })).status, 200);

  assert.equal((await call("POST", "/reviews/buyer", { token: buyer.token, body: { orderId: id, rating: 5 } })).status, 403);
  const s = await call("POST", "/reviews/buyer", { token: seller.token, body: { orderId: id, rating: 4, review: "Clear brief, quick replies" } });
  assert.equal(s.status, 200, JSON.stringify(s.json));
  assert.equal((await call("POST", "/reviews/buyer", { token: seller.token, body: { orderId: id, rating: 4 } })).status, 400);

  const hidden = await call("GET", `/reviews/buyer/order/${id}`, { token: buyer.token });
  assert.deepEqual(hidden.data.review, { pending: true });
  const sellerView = await call("GET", `/reviews/buyer/order/${id}`, { token: seller.token });
  assert.equal(sellerView.data.review.rating, 4);

  const b = await call("POST", "/reviews", { token: buyer.token, body: { orderId: id, rating: 5, review: "Great work", privateRating: 3, privateNote: "Slow at first" } });
  assert.ok([200, 201].includes(b.status), JSON.stringify(b.json));
  // Private rating never shows on public review lists.
  const list = await call("GET", `/reviews?gigId=${gig.id || gig._id}&limit=50`);
  const mineRev = list.json.data.attributes.results.find((x) => String(x.orderId?._id || x.orderId) === String(id));
  assert.ok(mineRev, "review is listed");
  assert.equal(mineRev.privateRating, undefined);
  assert.equal(mineRev.privateNote, undefined);
  const shown = await call("GET", `/reviews/buyer/order/${id}`, { token: buyer.token });
  assert.equal(shown.data.review.rating, 4);
  const pub = await call("GET", `/reviews/buyer/${buyer.user.id}`);
  assert.ok(pub.data.results.some((x) => String(x.orderId) === String(id)));
});
