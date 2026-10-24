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
  assert.equal(r.status, 200);
  return { token: r.data.tokens.access.token, user: r.data.user };
};

test("order lists only show the other party's public profile", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  for (const [who, path] of [[buyer, "/orders?limit=50"], [seller, "/orders/freelancer?limit=50"]]) {
    const r = await call("GET", path, { token: who.token });
    if (r.status === 404) continue;
    assert.equal(r.status, 200, path);
    const text = JSON.stringify(r.json);
    assert.ok(!text.includes("@example.com"), `${path} leaks an email`);
    assert.ok(!text.includes("sellerPlan"), `${path} leaks the seller plan`);
  }
});
