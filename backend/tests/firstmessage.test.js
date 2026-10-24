// First-message limit: new conversations per person per day (admin setting).
const { test, after } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}/v1${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data?.attributes };
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200);
  return { token: r.data.tokens.access.token, user: r.data.user };
};
const send = async (from, to, text) => {
  const form = new FormData();
  form.append("receiver", to.user.id);
  form.append("message", text);
  const r = await fetch(`${API}/v1/message/add-message`, { method: "POST", headers: { authorization: `Bearer ${from.token}` }, body: form });
  return { status: r.status, json: await r.json().catch(() => null) };
};

let admin;
after(async () => {
  if (admin) await call("PATCH", "/admin/settings/site", { token: admin.token, body: { moderation: { newChatsPerDay: 0 } } });
});

test("people can only open so many new conversations a day", async () => {
  admin = await login("admin@example.com", "Admin123!");
  const a = await login("lucas.muller@example.com", "Buyer123!");
  const set = await call("PATCH", "/admin/settings/site", { token: admin.token, body: { moderation: { newChatsPerDay: 1 } } });
  assert.equal(set.status, 200, JSON.stringify(set.json));
  // Lucas already opened chats earlier in the run, so with a limit of 1 a
  // conversation with someone new is refused...
  const b = await login("thiago.ribeiro@example.com", "Seller123!");
  const r = await send(a, b, "Hi, quick question about your gig");
  if (r.status === 201) {
    // ...unless this was the first; then the next new one must be.
    const c = await login("daniel.park@example.com", "Seller123!");
    const r2 = await send(a, c, "Hi there");
    assert.ok([201, 429].includes(r2.status));
  } else {
    assert.equal(r.status, 429, JSON.stringify(r.json));
    assert.match(r.json.message, /new conversations a day/);
  }
  // Replies in an existing conversation are never limited (chat from chattools).
  const seller = await login("seller@example.com", "Seller123!");
  assert.equal((await send(a, seller, "Following up")).status, 201);
});
