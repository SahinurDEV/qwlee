const { test, before } = require("node:test");
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
const balanceOf = async (s) => (await call("GET", `/users/${s.user.id}`, { token: s.token })).data.user.balance;
const sendOffer = async (seller, buyer, offer) => {
  const f = new FormData();
  f.append("receiver", buyer.user.id);
  f.append("offerDetails", JSON.stringify({ clientId: buyer.user.id, freelancerId: seller.user.id, gigTitle: "Milestone build", description: "Phased work", revisionDays: "1", ...offer }));
  const res = await fetch(`${API}/v1/message/add-message`, { method: "POST", headers: { authorization: `Bearer ${seller.token}` }, body: f });
  const json = await res.json().catch(() => null);
  return { status: res.status, msg: json?.data?.attributes ?? json?.data };
};
const hire = async (seller, buyer, t) => {
  const sent = await sendOffer(seller, buyer, { price: 100, milestones: [{ title: "Design", amount: 40, days: 3 }, { title: "Build", amount: 60, days: 7 }] });
  assert.equal(sent.status, 201, "offer with milestones is sent");
  const r = await call("POST", "/orders/checkout", { token: buyer.token, body: { messageId: String(sent.msg._id || sent.msg.id) } });
  if (r.status === 503) return t.skip("payments not configured");
  assert.ok(r.json.orderId, JSON.stringify(r.json));
  return r.json.orderId;
};

test("milestones: offers are validated, released one by one, last one completes the order", async (t) => {
  const seller = await login("seller@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  assert.equal((await sendOffer(seller, buyer, { price: 100, milestones: [{ title: "A", amount: 40, days: 2 }, { title: "B", amount: 50, days: 2 }] })).status, 400, "must add up to the price");
  assert.equal((await sendOffer(seller, buyer, { price: 100, milestones: [{ title: "A", amount: 100, days: 2 }] })).status, 400, "at least two");
  assert.equal((await sendOffer(seller, buyer, { price: 100, milestones: [{ title: "", amount: 50, days: 2 }, { title: "B", amount: 50, days: 2 }] })).status, 400, "titles required");

  const id = await hire(seller, buyer, t);
  if (!id) return;
  const fee = Number((await call("GET", "/info/config")).data?.platformFeePercent ?? NaN);
  let order = (await call("GET", `/orders/${id}`, { token: buyer.token })).data;
  assert.deepEqual(order.data.milestones.map((m) => [m.title, m.amount, m.status]), [["Design", 40, "pending"], ["Build", 60, "pending"]]);

  const before = await balanceOf(seller);
  assert.equal((await call("POST", `/orders/${id}/milestones/0/release`, { token: seller.token })).status, 403, "seller can't release");
  assert.equal((await call("POST", `/orders/${id}/milestones/5/release`, { token: buyer.token })).status, 404);
  const one = await call("POST", `/orders/${id}/milestones/0/release`, { token: buyer.token });
  assert.equal(one.status, 200, JSON.stringify(one.json));
  assert.equal(one.data.status, "active", "order stays open");
  assert.equal((await call("POST", `/orders/${id}/milestones/0/release`, { token: buyer.token })).status, 409, "no double release");
  const mid = await balanceOf(seller);
  assert.ok(mid > before && mid <= before + 40, "seller credited the first milestone, net of fee");
  if (Number.isFinite(fee)) assert.equal(Math.round((mid - before) * 100), Math.round(40 * (100 - fee)));

  const two = await call("POST", `/orders/${id}/milestones/1/release`, { token: buyer.token });
  assert.equal(two.status, 200);
  assert.equal(two.data.status, "delivered", "last milestone completes the order");
  order = (await call("GET", `/orders/${id}`, { token: buyer.token })).data;
  assert.equal(order.escrow.status, "released");
  assert.ok(order.data.milestones.every((m) => m.status === "released"));
  const after = await balanceOf(seller);
  assert.equal(Math.round((after - before) * 100), Math.round(order.sellerEarning * 100), "total paid equals seller earning");
  assert.ok(order.sellerEarning <= 100 && order.sellerEarning > 0);
});

test("milestones: cancelling refunds only what was not released", async (t) => {
  const seller = await login("seller@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const id = await hire(seller, buyer, t);
  if (!id) return;
  assert.equal((await call("POST", `/orders/${id}/milestones/0/release`, { token: buyer.token })).status, 200);
  const c = await call("PATCH", `/orders?orderId=${id}`, { token: seller.token, body: { status: "cancelled", reason: "Stopping after phase one" } });
  assert.equal(c.status, 201, JSON.stringify(c.json));
  const order = (await call("GET", `/orders/${id}`, { token: buyer.token })).data;
  assert.equal(order.status, "cancelled");
  assert.equal(order.escrow.refund.amount, 60, "only the unreleased 60 goes back");
  assert.equal((await call("POST", `/orders/${id}/milestones/1/release`, { token: buyer.token })).status, 409);
});
