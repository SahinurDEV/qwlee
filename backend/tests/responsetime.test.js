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
  return { status: res.status, data: json?.data?.attributes ?? json?.data };
};

test("public seller profile carries a measured response time", async () => {
  const login = await call("POST", "/auth/login", { body: { email: "seller@example.com", password: "Seller123!" } });
  const me = login.data.user;
  const pub = await call("GET", `/users/by-username/${me.username}`);
  assert.equal(pub.status, 200);
  const u = pub.data?.user || pub.data;
  assert.ok("responseMinutes" in u, "field present");
  assert.ok(u.responseMinutes === null || u.responseMinutes >= 1);
  const stats = await call("GET", `/users/stats/${me.id}`, { token: login.data.tokens.access.token });
  assert.equal(stats.status, 200);
});
