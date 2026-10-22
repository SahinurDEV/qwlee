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

test("quick replies: CRUD, validation, private to the owner", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  assert.equal((await call("POST", "/quick-replies", { token: seller.token, body: { title: "", body: "x" } })).status, 400);
  const c = await call("POST", "/quick-replies", { token: seller.token, body: { title: "Thanks", body: "Thanks for your order!" } });
  assert.equal(c.status, 201);
  const id = c.data.id;
  assert.ok((await call("GET", "/quick-replies", { token: seller.token })).data.results.some((q) => q.id === id));
  assert.ok(!(await call("GET", "/quick-replies", { token: buyer.token })).data.results.some((q) => q.id === id), "not visible to others");
  assert.equal((await call("PATCH", `/quick-replies/${id}`, { token: buyer.token, body: { title: "x", body: "y" } })).status, 404);
  assert.equal((await call("PATCH", `/quick-replies/${id}`, { token: seller.token, body: { title: "Thank you", body: "Thanks!" } })).data.title, "Thank you");
  assert.equal((await call("DELETE", `/quick-replies/${id}`, { token: seller.token })).status, 200);
});

test("read receipts: opening a thread marks the sender's messages seen", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const f = new FormData();
  f.append("message", "Read receipt check");
  f.append("receiver", buyer.user.id);
  const sent = await fetch(`${API}/v1/message/add-message`, { method: "POST", headers: { authorization: `Bearer ${seller.token}` }, body: f }).then((r) => r.json());
  const msg = sent.data?.attributes ?? sent.data;
  const chatId = String(msg.chat?._id || msg.chat?.id || msg.chat);
  assert.equal(msg.readed, false);
  const other = await login("moderator@example.com", "Admin123!");
  assert.notEqual((await call("POST", "/message/read", { token: other.token, body: { chatId } })).status, 200, "non-member can't mark");
  const r = await call("POST", "/message/read", { token: buyer.token, body: { chatId } });
  assert.equal(r.status, 200);
  assert.ok(r.data.marked >= 1);
  const list = await call("GET", `/message/get-messages?chatId=${chatId}&limit=200`, { token: seller.token });
  const m = (list.data?.data || list.json?.data?.attributes?.data || []).find((x) => String(x._id || x.id) === String(msg._id || msg.id));
  assert.ok(m, "message listed");
  assert.equal(m.readed, true);
  assert.ok(m.readAt);
  assert.equal(m.sender.email, undefined, "partner email not exposed");
  const chats = await call("GET", "/chat/get-chat", { token: seller.token });
  assert.ok(!JSON.stringify(chats.json).includes("@example.com"), "chat list hides partner emails");
});
