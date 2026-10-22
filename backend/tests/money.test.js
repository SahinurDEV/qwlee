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

let buyer, sup, fin, gig;
before(async () => {
  buyer = await login("buyer@example.com", "Buyer123!");
  sup = await login("admin@example.com", "Admin123!");
  fin = await login("finance@example.com", "Admin123!");
  gig = (await call("GET", "/gig?limit=1")).data.results[0];
});
const order = async () => {
  const r = await call("POST", "/orders/checkout", { token: buyer.token, body: { gigId: gig.id || gig._id, packageName: gig.package[0].name } });
  return r;
};

test("invalid ids answer 400, not 500", async () => {
  assert.equal((await call("GET", "/admin/orders/not-an-id", { token: sup.token })).status, 400);
  assert.equal((await call("GET", "/gig/not-an-id")).status, 400);
});

test("refund returns the money through the provider (demo) and is recorded", async (t) => {
  const r = await order();
  if (r.status === 503) return t.skip("payments not configured");
  const id = r.json.orderId;
  const ref = await call("POST", `/admin/orders/${id}/refund`, { token: sup.token, body: { reason: "test" } });
  assert.equal(ref.status, 200, JSON.stringify(ref.json));
  assert.equal(ref.data.order.escrow.status, "refunded");
  assert.equal(ref.data.refund.provider, "demo");
  assert.equal(ref.data.refund.status, "succeeded");
  assert.equal((await call("POST", `/admin/orders/${id}/refund`, { token: sup.token })).status, 409, "no double refund");
});

test("second approval: large refunds wait for a different admin", async (t) => {
  const site = (await call("GET", "/admin/settings/site", { token: sup.token })).data.site || (await call("GET", "/admin/settings/site", { token: sup.token })).data;
  const orig = site.marketplace.secondApprovalOver || 0;
  await call("PATCH", "/admin/settings/site", { token: sup.token, body: { marketplace: { secondApprovalOver: 1 } } });
  try {
    const r = await order();
    if (r.status === 503) return t.skip("payments not configured");
    const id = r.json.orderId;
    const first = await call("POST", `/admin/orders/${id}/refund`, { token: sup.token, body: { reason: "big one" } });
    assert.equal(first.status, 202);
    const apId = first.data.approval.id;
    const still = (await call("GET", `/admin/orders/${id}`, { token: sup.token })).data;
    assert.equal((still.order || still).escrow.status, "held", "nothing moved yet");
    assert.equal((await call("POST", `/admin/approvals/${apId}/approve`, { token: sup.token })).status, 403, "requester cannot approve");
    const ok = await call("POST", `/admin/approvals/${apId}/approve`, { token: fin.token });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    const after = (await call("GET", `/admin/orders/${id}`, { token: sup.token })).data;
    assert.equal((after.order || after).escrow.status, "refunded");
    assert.equal((await call("POST", `/admin/approvals/${apId}/approve`, { token: fin.token })).status, 409, "single use");
  } finally {
    await call("PATCH", "/admin/settings/site", { token: sup.token, body: { marketplace: { secondApprovalOver: orig } } });
  }
});
