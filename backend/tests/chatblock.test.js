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
const send = async (from, to, text) => {
  const f = new FormData();
  f.append("message", text);
  f.append("receiver", to.user.id);
  const res = await fetch(`${API}/v1/message/add-message`, { method: "POST", headers: { authorization: `Bearer ${from.token}` }, body: f });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data?.attributes ?? json?.data };
};

test("chat block: members only, blocks sending both ways, unblock restores", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const lucas = await login("lucas.muller@example.com", "Buyer123!");
  const outsider = await login("thiago.ribeiro@example.com", "Seller123!");
  const first = await send(lucas, seller, "Block test hello");
  assert.equal(first.status, 201);
  const chatId = String(first.data.chat?._id || first.data.chat?.id || first.data.chat);

  assert.equal((await call("PATCH", `/chat/${chatId}`, { token: outsider.token, body: { action: "block" } })).status, 404, "outsider can't block");
  assert.equal((await call("PATCH", `/chat/${chatId}`, { token: seller.token, body: { action: "nope" } })).status, 400);
  assert.equal((await call("PATCH", `/chat/${chatId}`, { token: seller.token, body: { action: "block" } })).status, 200);

  assert.equal((await send(lucas, seller, "can you hear me")).status, 403, "blocked party can't send");
  assert.equal((await send(seller, lucas, "me neither")).status, 403, "blocker can't send either");
  assert.equal((await call("PATCH", `/chat/${chatId}`, { token: lucas.token, body: { action: "unblock" } })).status, 200);
  assert.equal((await send(lucas, seller, "still blocked")).status, 403, "only the blocker's own block is lifted");

  assert.equal((await call("PATCH", `/chat/${chatId}`, { token: seller.token, body: { action: "unblock" } })).status, 200);
  assert.equal((await send(lucas, seller, "Back again")).status, 201);
});

test("messages: only sender and receiver can read, delete or change an offer", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const lucas = await login("lucas.muller@example.com", "Buyer123!");
  const outsider = await login("thiago.ribeiro@example.com", "Seller123!");
  const sent = await send(seller, lucas, "Ownership check");
  assert.equal(sent.status, 201);
  const id = String(sent.data._id || sent.data.id);
  assert.equal((await call("GET", `/message/${id}`, { token: outsider.token })).status, 404);
  assert.equal((await call("GET", `/message/${id}`, { token: lucas.token })).status, 200);
  assert.equal((await call("DELETE", `/message/${id}`, { token: outsider.token })).status, 404);
  assert.equal((await call("PUT", `/message/${id}`, { token: outsider.token })).status, 404);
  assert.equal((await call("PATCH", `/message/${id}`, { token: outsider.token, body: { status: "rejected" } })).status, 404);
  assert.equal((await call("PATCH", `/message/${id}`, { token: lucas.token, body: { status: "accepted" } })).status, 403, "can't accept without paying");
});
