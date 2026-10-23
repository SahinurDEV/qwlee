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

test("contests: funded prize, entries, sealed visibility, award, handover, prize release, cancel refund", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  await call("POST", "/hourly/wallet/topup", { token: buyer.token, body: { amount: 500 } });
  assert.equal((await call("POST", "/contests", { token: buyer.token, body: { title: "Logo", brief: "short", prize: 5, days: 3 } })).status, 400);
  const mk = await call("POST", "/contests", { token: buyer.token, body: { title: `Logo for a bakery ${Date.now()}`, brief: "We need a warm, friendly logo for our family bakery.", prize: 100, days: 5, sealed: true } });
  assert.equal(mk.status, 201, JSON.stringify(mk.json));
  const id = idOf(mk.data);
  assert.ok((await call("GET", "/contests")).data.results.some((c) => idOf(c) === id), "listed publicly");
  assert.equal((await call("POST", `/contests/${id}/entries`, { token: buyer.token, body: { description: "my own entry", links: ["https://x.test/a.png"] } })).status, 403);
  assert.equal((await call("POST", `/contests/${id}/entries`, { token: seller.token, body: { description: "Warm hand-drawn logo", links: ["javascript:alert(1)"] } })).status, 400);
  const en = await call("POST", `/contests/${id}/entries`, { token: seller.token, body: { description: "Warm hand-drawn wheat logo", links: ["https://example.com/logo.png"] } });
  assert.equal(en.status, 201, JSON.stringify(en.json));
  const entryId = idOf(en.data.entries[0]);
  assert.equal((await call("GET", `/contests/${id}`)).data.entries.length, 0, "sealed: anonymous sees no entries");
  assert.equal((await call("GET", `/contests/${id}`)).data.entryCount, 1);
  assert.equal((await call("POST", `/contests/${id}/cancel`, { token: buyer.token })).status, 409, "can't cancel with entries");
  assert.equal((await call("POST", `/contests/${id}/award`, { token: seller.token, body: { entryId } })).status, 403);
  assert.equal((await call("POST", `/contests/${id}/award`, { token: buyer.token, body: { entryId } })).data.status, "handover");
  assert.equal((await call("POST", `/contests/${id}/accept-handover`, { token: buyer.token })).status, 409, "nothing handed over yet");
  assert.equal((await call("POST", `/contests/${id}/handover`, { token: seller.token, body: { note: "AI + SVG files", links: ["https://example.com/final.zip"] } })).status, 200);
  const before = (await call("GET", "/users/me/plan", { token: seller.token })).data.balance;
  const done = await call("POST", `/contests/${id}/accept-handover`, { token: buyer.token });
  assert.equal(done.status, 200, JSON.stringify(done.json));
  assert.equal(done.data.status, "completed");
  const after = (await call("GET", "/users/me/plan", { token: seller.token })).data.balance;
  assert.equal(Math.round((after - before) * 100) / 100, done.data.payout.net);
  assert.equal((await call("POST", `/contests/${id}/accept-handover`, { token: buyer.token })).status, 409, "paid once");

  // A contest with no entries can be cancelled for a refund.
  const b0 = (await call("POST", "/hourly/wallet/topup", { token: buyer.token, body: { amount: 5 } })).data.balance;
  const c2 = await call("POST", "/contests", { token: buyer.token, body: { title: `Banner contest ${Date.now()}`, brief: "A banner for our website header, modern style.", prize: 50, days: 2 } });
  const cancelled = await call("POST", `/contests/${idOf(c2.data)}/cancel`, { token: buyer.token });
  assert.equal(cancelled.data.status, "cancelled");
  const b1 = (await call("POST", "/hourly/wallet/topup", { token: buyer.token, body: { amount: 5 } })).data.balance;
  assert.equal(Math.round((b1 - b0) * 100) / 100, 5, "prize refunded");
});
