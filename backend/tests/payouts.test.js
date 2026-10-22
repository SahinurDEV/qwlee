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

test("payouts: PayPal and Payoneer withdrawals, demo provider without credentials", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const fin = await login("finance@example.com", "Admin123!");
  const methods = (await call("GET", "/withdrawal/methods", { token: seller.token })).data;
  assert.equal(methods.bank, "manual");
  assert.ok(["demo", "sandbox", "live"].includes(methods.paypal));

  const bad = [
    { method: "paypal", payoutAccount: "not-an-email" },
    { method: "payoneer", payoutAccount: "x" },
    { method: "crypto", payoutAccount: "a@b.co" },
    { method: "bank" },
  ];
  for (const b of bad) assert.equal((await call("POST", "/withdrawal", { token: seller.token, body: { withdrawalAmount: 20, ...b } })).status, 400, JSON.stringify(b));

  for (const [method, payoutAccount] of [["paypal", "sofia@example.com"], ["payoneer", "PAYEE-12345"]]) {
    const w = await call("POST", "/withdrawal", { token: seller.token, body: { withdrawalAmount: 20, method, payoutAccount } });
    assert.equal(w.status, 201, JSON.stringify(w.json));
    const wd = w.data?.withdrawal || w.data;
    assert.equal(wd.method, method);
    assert.equal(wd.payoutAccount, payoutAccount);
    const ok = await call("POST", `/withdrawal/${wd._id || wd.id}`, { token: fin.token });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    const done = ok.data?.withdrawal || ok.data;
    assert.equal(done.status, "Completed");
    if (methods[method] === "demo") assert.equal(done.payout.provider, "demo");
    assert.equal((await call("POST", `/withdrawal/${wd._id || wd.id}`, { token: fin.token })).status, 409, "no double payout");
  }
});

test("payouts: provider request shapes (stubbed HTTP)", async () => {
  const svc = require("../src/services/payouts.service");
  const seen = [];
  const stub = async (url, init) => {
    seen.push({ url, init });
    if (url.endsWith("/v1/oauth2/token")) return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) };
    if (url.endsWith("/v1/payments/payouts")) return { ok: true, status: 201, json: async () => ({ batch_header: { payout_batch_id: "B1", batch_status: "PENDING" } }) };
    if (url.includes("/masspayouts")) return { ok: true, status: 200, json: async () => ({ result: { payout_id: "P1" } }) };
    return { ok: false, status: 500, json: async () => ({}) };
  };
  Object.assign(process.env, { PAYPAL_CLIENT_ID: "id", PAYPAL_CLIENT_SECRET: "secret", PAYONEER_API_TOKEN: "t", PAYONEER_PROGRAM_ID: "100" });
  const w = { _id: "w1", withdrawalAmount: 25, payoutAccount: "a@b.co", method: "paypal" };
  const pp = await svc.send(w, stub);
  assert.deepEqual([pp.provider, pp.id, pp.status], ["paypal", "B1", "pending"]);
  assert.match(seen[0].url, /sandbox\.paypal\.com\/v1\/oauth2\/token$/);
  assert.equal(seen[0].init.headers.authorization, `Basic ${Buffer.from("id:secret").toString("base64")}`);
  const body = JSON.parse(seen[1].init.body);
  assert.equal(body.sender_batch_header.sender_batch_id, "qwlee-w1", "idempotent per withdrawal");
  assert.deepEqual(body.items[0].amount, { value: "25.00", currency: "USD" });
  assert.equal(body.items[0].receiver, "a@b.co");
  const po = await svc.send({ ...w, method: "payoneer", payoutAccount: "PAYEE1" }, stub);
  assert.deepEqual([po.provider, po.id], ["payoneer", "P1"]);
  assert.match(seen[2].url, /\/v4\/programs\/100\/masspayouts$/);
  assert.equal(JSON.parse(seen[2].init.body).Payments[0].payee_id, "PAYEE1");
  await assert.rejects(svc.send({ ...w, method: "paypal" }, async () => ({ ok: false, status: 401, json: async () => ({}) })), /PayPal auth failed/);
  for (const k of ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYONEER_API_TOKEN", "PAYONEER_PROGRAM_ID"]) delete process.env[k];
});
