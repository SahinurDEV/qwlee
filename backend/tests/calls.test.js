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

test("order calls: propose slots, other side accepts, meeting link, permissions", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  const mine = (await call("GET", "/orders?limit=50", { token: buyer.token })).data;
  const list = mine?.results || mine || [];
  const order = list.find((o) => idOf(o.freelancerId) === idOf(seller.user));
  assert.ok(order, "seed has a buyer↔seller order");
  const oid = idOf(order);
  const t1 = new Date(Date.now() + 86400000).toISOString();
  const t2 = new Date(Date.now() + 2 * 86400000).toISOString();
  assert.equal((await call("POST", `/orders/${oid}/calls`, { token: buyer.token, body: { slots: [new Date(Date.now() - 1000).toISOString()] } })).status, 400, "past slots rejected");
  const p = await call("POST", `/orders/${oid}/calls`, { token: buyer.token, body: { slots: [t1, t2], topic: "Kickoff", durationMin: 30 } });
  assert.equal(p.status, 201, JSON.stringify(p.json));
  const cid = idOf(p.data);
  assert.equal((await call("POST", `/orders/${oid}/calls/${cid}/accept`, { token: buyer.token, body: { slot: t1 } })).status, 403, "proposer can't accept");
  assert.equal((await call("POST", `/orders/${oid}/calls/${cid}/accept`, { token: seller.token, body: { slot: new Date(Date.now() + 3 * 86400000).toISOString() } })).status, 400);
  const a = await call("POST", `/orders/${oid}/calls/${cid}/accept`, { token: seller.token, body: { slot: t2 } });
  assert.equal(a.status, 200);
  assert.equal(a.data.status, "scheduled");
  assert.match(a.data.meetingUrl, /^https?:\/\/.+\/qwlee-[0-9a-f]{16}$/);
  assert.equal(new Date(a.data.startsAt).toISOString(), t2);
  const l = (await call("GET", `/orders/${oid}/calls`, { token: seller.token })).data;
  assert.ok(l.some((c) => idOf(c) === cid));
  assert.equal((await call("POST", `/orders/${oid}/calls/${cid}/cancel`, { token: buyer.token })).data.status, "cancelled");
});
