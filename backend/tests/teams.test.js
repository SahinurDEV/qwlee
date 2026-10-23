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

test("teams: create, invite by email, accept, shared orders, permissions, leave", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  const t = await call("POST", "/teams", { token: buyer.token, body: { name: `Acme ${Date.now()}` } });
  assert.equal(t.status, 201, JSON.stringify(t.json));
  const id = idOf(t.data);
  assert.equal((await call("POST", `/teams/${id}/invite`, { token: buyer.token, body: { email: "nope" } })).status, 400);
  assert.equal((await call("POST", `/teams/${id}/invite`, { token: buyer.token, body: { email: "seller@example.com" } })).status, 201);
  assert.equal((await call("POST", `/teams/${id}/invite`, { token: buyer.token, body: { email: "seller@example.com" } })).status, 409);
  assert.equal((await call("GET", `/teams/${id}/orders`, { token: seller.token })).status, 403, "invite not accepted yet");
  const mine = (await call("GET", "/teams", { token: seller.token })).data;
  assert.ok(mine.invites.some((i) => i.id === id));
  assert.equal((await call("POST", `/teams/${id}/accept`, { token: seller.token })).status, 200);
  const o = await call("GET", `/teams/${id}/orders`, { token: seller.token });
  assert.equal(o.status, 200);
  assert.ok(o.data.results.some((r) => idOf(r.clientId) === idOf(buyer.user)), "member sees the owner's orders");
  assert.equal((await call("POST", `/teams/${id}/invite`, { token: seller.token, body: { email: "x@example.com" } })).status, 403, "members can't invite");
  const team = (await call("GET", "/teams", { token: buyer.token })).data.teams.find((x) => idOf(x) === id);
  const owner = team.members.find((m) => m.role === "owner");
  const member = team.members.find((m) => m.role === "member");
  assert.equal((await call("DELETE", `/teams/${id}/members/${idOf(owner)}`, { token: seller.token })).status, 400);
  assert.equal((await call("DELETE", `/teams/${id}/members/${idOf(member)}`, { token: seller.token })).status, 200, "member can leave");
  assert.equal((await call("GET", `/teams/${id}/orders`, { token: seller.token })).status, 403);
});
