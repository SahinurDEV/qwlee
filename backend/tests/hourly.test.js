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

test("hourly contract: offer, accept, log time within limit, weekly invoice, approve and auto-pay", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  const admin = await login("admin@example.com", "Admin123!");
  const sid = idOf(seller.user);
  assert.equal((await call("POST", "/hourly", { token: buyer.token, body: { sellerId: sid, title: "Ongoing", rate: 1, weeklyLimit: 5 } })).status, 400, "rate too low");
  const mk = await call("POST", "/hourly", { token: buyer.token, body: { sellerId: sid, title: `Ongoing dev help ${Date.now()}`, rate: 40, weeklyLimit: 5 } });
  assert.equal(mk.status, 201, JSON.stringify(mk.json));
  const id = idOf(mk.data);
  assert.equal((await call("POST", `/hourly/${id}/time`, { token: seller.token, body: { hours: 1 } })).status, 409, "not active yet");
  assert.equal((await call("POST", `/hourly/${id}/accept`, { token: buyer.token })).status, 403);
  assert.equal((await call("POST", `/hourly/${id}/accept`, { token: seller.token })).data.status, "active");
  assert.equal((await call("POST", `/hourly/${id}/time`, { token: seller.token, body: { hours: 3, memo: "API work" } })).status, 201);
  assert.equal((await call("POST", `/hourly/${id}/time`, { token: seller.token, body: { hours: 3 } })).status, 400, "over weekly limit");
  assert.equal((await call("POST", `/hourly/${id}/time`, { token: buyer.token, body: { hours: 1 } })).status, 403);
  const view = (await call("GET", `/hourly/${id}`, { token: buyer.token })).data;
  assert.equal(view.thisWeek.hours, 3);
  assert.equal((await call("GET", `/hourly/${id}`, { token: (await login("moderator@example.com", "Admin123!")).token })).status === 200, true, "admins can view");

  // Close the week (support tool moves time forward).
  const asOf = new Date(Date.now() + 8 * 864e5).toISOString();
  const run = await call("POST", "/admin/hourly/run", { token: admin.token, body: { asOf } });
  assert.equal(run.status, 200, JSON.stringify(run.json));
  assert.ok(run.data.invoiced >= 1);
  let c = (await call("GET", `/hourly/${id}`, { token: buyer.token })).data.contract;
  const inv = c.invoices[0];
  assert.equal(inv.hours, 3);
  assert.equal(inv.amount, 120);
  assert.equal(inv.status, "review");

  await call("POST", "/hourly/wallet/topup", { token: buyer.token, body: { amount: 200 } });
  const before = (await call("GET", "/users/me/plan", { token: seller.token })).data.balance;
  const ap = await call("POST", `/hourly/${id}/invoices/${idOf(inv)}/approve`, { token: buyer.token });
  assert.equal(ap.status, 200, JSON.stringify(ap.json));
  c = ap.data;
  const paid = c.invoices[0];
  assert.equal(paid.status, "paid");
  assert.equal(Math.round(paid.fee * 100 + paid.net * 100), 12000);
  const after = (await call("GET", "/users/me/plan", { token: seller.token })).data.balance;
  assert.equal(Math.round((after - before) * 100) / 100, paid.net, "seller credited net");
  assert.equal((await call("POST", `/hourly/${id}/invoices/${idOf(inv)}/approve`, { token: buyer.token })).status, 409, "no double pay");

  // Second week: no buyer action → paid after the review window.
  await call("POST", `/hourly/${id}/time`, { token: seller.token, body: { hours: 1 } });
  await call("POST", "/admin/hourly/run", { token: admin.token, body: { asOf, payAsOf: new Date(Date.now() + 20 * 864e5).toISOString() } });
  c = (await call("GET", `/hourly/${id}`, { token: buyer.token })).data.contract;
  assert.equal(c.invoices.length, 2);
  assert.equal(c.invoices[1].status, "paid", "auto-paid after review");
  assert.equal((await call("POST", `/hourly/${id}/end`, { token: buyer.token })).data.status, "ended");
});
