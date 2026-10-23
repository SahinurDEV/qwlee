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

test("seller plus: plans listed, subscribe charges balance, badge and credits, cancel, admin comp/reset", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const admin = await login("admin@example.com", "Admin123!");
  const sid = idOf(seller.user);
  try {
    const p0 = (await call("GET", "/users/me/plan", { token: seller.token })).data;
    assert.equal(p0.current.id, "free");
    assert.deepEqual(p0.plans.map((p) => p.id), ["free", "plus", "premium"]);
    const plus = p0.plans.find((p) => p.id === "plus");
    assert.equal((await call("POST", "/users/me/plan", { token: buyer.token, body: { tier: "plus" } })).status, 403);
    assert.equal((await call("POST", "/users/me/plan", { token: seller.token, body: { tier: "gold" } })).status, 400);
    const credits0 = (await call("GET", "/requests/credits/me", { token: seller.token })).data.total;
    const s = await call("POST", "/users/me/plan", { token: seller.token, body: { tier: "plus" } });
    assert.equal(s.status, 200, JSON.stringify(s.json));
    assert.equal(s.data.current.id, "plus");
    assert.equal(Math.round((p0.balance - s.data.balance) * 100) / 100, plus.price, "charged from balance");
    assert.equal((await call("GET", "/requests/credits/me", { token: seller.token })).data.total, credits0 + plus.extraCredits);
    const pub = (await call("GET", `/users/public?userId=${sid}`)).json;
    assert.match(JSON.stringify(pub), /"planBadge":"plus"/);
    const c = await call("POST", "/users/me/plan/cancel", { token: seller.token });
    assert.equal(c.data.current.cancelAtPeriodEnd, true);
    // Resubscribing to the same tier resumes without a second charge.
    const again = await call("POST", "/users/me/plan", { token: seller.token, body: { tier: "plus" } });
    assert.equal(again.data.balance, s.data.balance);
    assert.equal(again.data.current.cancelAtPeriodEnd, false);
    const comp = await call("PATCH", `/admin/users/${sid}/seller-plan`, { token: admin.token, body: { tier: "premium", days: 7 } });
    assert.equal(comp.status, 200, JSON.stringify(comp.json));
    assert.equal(comp.data.current.id, "premium");
  } finally {
    const r = await call("PATCH", `/admin/users/${sid}/seller-plan`, { token: admin.token, body: { tier: "free" } });
    assert.equal(r.data.current.id, "free");
  }
});
