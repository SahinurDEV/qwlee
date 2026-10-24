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
const send = async (from, to, text, extra = {}) => {
  const f = new FormData();
  f.append("message", text);
  f.append("receiver", to.user.id);
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  const res = await fetch(`${API}/v1/message/add-message`, { method: "POST", headers: { authorization: `Bearer ${from.token}` }, body: f });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data?.attributes ?? json?.data };
};
const idOf = (m) => String(m?._id || m?.id);
const chatOf = (m) => String(m.chat?._id || m.chat?.id || m.chat);

test("chat: reply, delete for me / everyone, newest page first", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const lucas = await login("lucas.muller@example.com", "Buyer123!");
  const first = await send(lucas, seller, "Question about the logo package");
  assert.equal(first.status, 201);
  const chatId = chatOf(first.data);
  const reply = await send(seller, lucas, "Sure, ask away", { replyTo: idOf(first.data) });
  assert.equal(reply.status, 201);
  assert.equal(reply.data.replyTo?.content?.message, "Question about the logo package");

  // A reply can't point into another conversation.
  const thiago = await login("thiago.ribeiro@example.com", "Seller123!");
  assert.equal((await send(thiago, lucas, "x", { replyTo: idOf(first.data) })).status, 400);

  // Delete for everyone: sender only.
  assert.equal((await call("DELETE", `/message/${idOf(reply.data)}?scope=everyone`, { token: lucas.token })).status, 403);
  assert.equal((await call("DELETE", `/message/${idOf(reply.data)}?scope=everyone`, { token: seller.token })).status, 200);
  const list = await call("GET", `/message/get-messages?chatId=${chatId}&limit=200`, { token: lucas.token });
  const wiped = list.data.data.find((m) => idOf(m) === idOf(reply.data));
  assert.equal(wiped.deletedForEveryone, true);
  assert.equal(wiped.content.message, "");

  // Delete for me hides it only for me.
  assert.equal((await call("DELETE", `/message/${idOf(first.data)}`, { token: lucas.token })).status, 200);
  const mine = await call("GET", `/message/get-messages?chatId=${chatId}&limit=200`, { token: lucas.token });
  assert.ok(!mine.data.data.some((m) => idOf(m) === idOf(first.data)));
  const theirs = await call("GET", `/message/get-messages?chatId=${chatId}&limit=200`, { token: seller.token });
  assert.ok(theirs.data.data.some((m) => idOf(m) === idOf(first.data)));

  // Page 1 holds the newest messages, oldest first within the page.
  const last = await send(lucas, seller, "Newest message marker");
  const p1 = await call("GET", `/message/get-messages?chatId=${chatId}&limit=2&page=1`, { token: seller.token });
  assert.equal(idOf(p1.data.data[p1.data.data.length - 1]), idOf(last.data));
});

test("chat: search, archive, pin, report, context", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const lucas = await login("lucas.muller@example.com", "Buyer123!");
  const outsider = await login("thiago.ribeiro@example.com", "Seller123!");
  const marker = `zebra-${Date.now()}`;
  const m = await send(lucas, seller, `Looking for ${marker} design`);
  const chatId = chatOf(m.data);

  assert.equal((await call("GET", "/message/search?q=z", { token: seller.token })).status, 400);
  const found = await call("GET", `/message/search?q=${marker}`, { token: seller.token });
  assert.equal(found.status, 200);
  assert.ok(found.data.results.some((r) => idOf(r) === idOf(m.data)));
  assert.equal((await call("GET", `/message/search?q=${marker}`, { token: outsider.token })).data.results.length, 0);
  assert.equal((await call("GET", `/message/search?q=${marker}&chatId=${chatId}`, { token: outsider.token })).status, 404);

  // Archive hides from the inbox, ?archived=true lists it; pin un-archives and sorts first.
  assert.equal((await call("PATCH", `/chat/${chatId}`, { token: seller.token, body: { action: "archive" } })).status, 200);
  const inbox = await call("GET", "/chat/get-chat", { token: seller.token });
  assert.ok(!inbox.data.data.some((d) => String(d.chat.id || d.chat._id) === chatId));
  const arch = await call("GET", "/chat/get-chat?archived=true", { token: seller.token });
  assert.ok(arch.data.data.some((d) => String(d.chat.id || d.chat._id) === chatId && d.archived));
  assert.equal((await call("PATCH", `/chat/${chatId}`, { token: seller.token, body: { action: "pin" } })).status, 200);
  const pinned = await call("GET", "/chat/get-chat", { token: seller.token });
  assert.equal(String(pinned.data.data[0].chat.id || pinned.data.data[0].chat._id), chatId);
  assert.equal(pinned.data.data[0].pinned, true);
  assert.equal((await call("PATCH", `/chat/${chatId}`, { token: seller.token, body: { action: "unpin" } })).status, 200);
  assert.equal((await call("PATCH", `/chat/${chatId}`, { token: outsider.token, body: { action: "pin" } })).status, 404);

  // Report: members only, valid reason, lands in the admin flag queue once.
  assert.equal((await call("POST", `/chat/${chatId}/report`, { token: outsider.token, body: { reason: "spam" } })).status, 404);
  assert.equal((await call("POST", `/chat/${chatId}/report`, { token: seller.token, body: { reason: "nope" } })).status, 400);
  const rep = await call("POST", `/chat/${chatId}/report`, { token: seller.token, body: { reason: "off-platform", note: "asked to pay by bank transfer" } });
  assert.equal(rep.status, 201);
  assert.equal((await call("POST", `/chat/${chatId}/report`, { token: seller.token, body: { reason: "spam" } })).status, 409);
  const admin = await login("admin@example.com", "Admin123!");
  const flags = await call("GET", "/admin/risk-flags?status=open&kind=chat", { token: admin.token });
  assert.ok(JSON.stringify(flags.json).includes(chatId), "report visible to admins");

  // Context: orders between the two members; outsiders can't read it.
  assert.equal((await call("GET", `/chat/${chatId}/context`, { token: outsider.token })).status, 404);
  const ctx = await call("GET", `/chat/${chatId}/context`, { token: seller.token });
  assert.equal(ctx.status, 200);
  assert.ok(Array.isArray(ctx.data.orders));
  assert.equal((await call("GET", `/chat/${chatId}`, { token: outsider.token })).status, 404, "chat details are members-only");
});
