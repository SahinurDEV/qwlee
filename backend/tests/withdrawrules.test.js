// Withdrawal minimum per method and the hold after payout details change.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}/v1${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200);
  return { token: r.json.data.attributes.tokens.access.token, user: r.json.data.attributes.user };
};
let admin;
after(async () => {
  if (admin) await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { payoutChangeHoldHours: 0, withdrawMinPaypal: 1 } } });
});

test("per-method minimum and payout change hold", async () => {
  admin = await login("admin@example.com", "Admin123!");
  assert.equal((await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { withdrawMinPaypal: 7, payoutChangeHoldHours: 24 } } })).status, 200);
  const seller = await login("seller@example.com", "Seller123!");
  const w = (body) => call("POST", "/withdrawal", { token: seller.token, body });
  const low = await w({ method: "paypal", payoutAccount: "a@example.com", withdrawalAmount: 5 });
  assert.equal(low.status, 400);
  assert.match(low.json.message, /Minimum withdrawal by PayPal is \$7/);
  // First use of a destination is allowed (or fails only for balance);
  // switching to a different one is held.
  const first = await w({ method: "paypal", payoutAccount: `first${Date.now()}@example.com`, withdrawalAmount: 8 });
  assert.ok([201, 400].includes(first.status));
  const changed = await w({ method: "paypal", payoutAccount: `other${Date.now()}@example.com`, withdrawalAmount: 8 });
  assert.equal(changed.status, 400);
  assert.match(changed.json.message, /payout details/i);
});
