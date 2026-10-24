// Contact details are hidden in messages until the two users have an order.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const login = async (email, password) => {
  const r = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  assert.equal(r.status, 200);
  return { token: j.data.attributes.tokens.access.token, user: j.data.attributes.user };
};
const send = async (from, to, text) => {
  const form = new FormData();
  form.append("receiver", to.user.id);
  form.append("message", text);
  const r = await fetch(`${API}/v1/message/add-message`, { method: "POST", headers: { authorization: `Bearer ${from.token}` }, body: form });
  return { status: r.status, json: await r.json().catch(() => null) };
};

test("contact details are masked before an order exists", async () => {
  const a = await login("seller@example.com", "Seller123!");
  const b = await login("daniel.park@example.com", "Seller123!");
  const r = await send(a, b, "Email me at someone@example.com or call +1 415 555 0134 thanks");
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const msg = r.json.data.content?.message || r.json.data?.attributes?.content?.message;
  assert.ok(!/someone@example\.com/.test(msg), msg);
  assert.ok(!/555 0134/.test(msg), msg);
  assert.match(msg, /contact details hidden/);
  assert.match(r.json.message, /Contact details were hidden/);
  const plain = await send(a, b, "Hello, how are you?");
  assert.equal(plain.status, 201);
  assert.equal(plain.json.message, "Message added successfully");
});
