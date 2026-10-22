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

test("support canned replies: CRUD, validation and permissions", async () => {
  const mod = await login("moderator@example.com", "Admin123!");
  const fin = await login("finance@example.com", "Admin123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  assert.equal((await call("GET", "/admin/support/canned", { token: buyer.token })).status, 403);
  assert.equal((await call("POST", "/admin/support/canned", { token: fin.token, body: { title: "x", body: "y" } })).status, 403, "finance lacks support");
  assert.equal((await call("POST", "/admin/support/canned", { token: mod.token, body: { title: "", body: "y" } })).status, 400);
  const c = await call("POST", "/admin/support/canned", { token: mod.token, body: { title: "Refund timing", body: "Hi {name}, refunds take 3-5 days." } });
  assert.equal(c.status, 200, JSON.stringify(c.json));
  const id = c.data.reply._id;
  try {
    const l = await call("GET", "/admin/support/canned", { token: fin.token });
    assert.ok(l.data.results.some((r) => r._id === id), "readable by any admin");
    const u = await call("PATCH", `/admin/support/canned/${id}`, { token: mod.token, body: { title: "Refunds", body: "Hi {name}, 3-5 business days." } });
    assert.equal(u.data.reply.title, "Refunds");
  } finally {
    assert.equal((await call("DELETE", `/admin/support/canned/${id}`, { token: mod.token })).status, 200);
  }
  assert.equal((await call("DELETE", `/admin/support/canned/${id}`, { token: mod.token })).status, 404);
});
