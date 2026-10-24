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
const send = async (from, to, text, file) => {
  const f = new FormData();
  if (text) f.append("message", text);
  f.append("receiver", to.user.id);
  if (file) f.append("files", file.blob, file.name);
  const res = await fetch(`${API}/v1/message/add-message`, { method: "POST", headers: { authorization: `Bearer ${from.token}` }, body: f });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data?.attributes ?? json?.data };
};
const idOf = (m) => String(m?._id || m?.id);
const chatOf = (m) => String(m.chat?._id || m.chat?.id || m.chat);

test("chat extras: edit, reactions, translate fallback, voice notes", async () => {
  const seller = await login("thiago.ribeiro@example.com", "Seller123!");
  const lucas = await login("lucas.muller@example.com", "Buyer123!");
  const sent = await send(lucas, seller, "Can you do a 2-day delivery?");
  assert.equal(sent.status, 201);
  const id = idOf(sent.data);

  // Edit: sender only, non-empty.
  assert.equal((await call("PATCH", `/message/${id}/edit`, { token: seller.token, body: { message: "hijack" } })).status, 403);
  assert.equal((await call("PATCH", `/message/${id}/edit`, { token: lucas.token, body: { message: "  " } })).status, 400);
  const edited = await call("PATCH", `/message/${id}/edit`, { token: lucas.token, body: { message: "Can you do a 3-day delivery?" } });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.content.message, "Can you do a 3-day delivery?");
  assert.ok(edited.data.editedAt);

  // Reactions: fixed set, one per member, toggles.
  assert.equal((await call("POST", `/message/${id}/react`, { token: seller.token, body: { emoji: "💩" } })).status, 400);
  let r = await call("POST", `/message/${id}/react`, { token: seller.token, body: { emoji: "👍" } });
  assert.equal(r.status, 200);
  assert.equal(r.data.reactions.length, 1);
  r = await call("POST", `/message/${id}/react`, { token: seller.token, body: { emoji: "❤️" } });
  assert.deepEqual(r.data.reactions.map((x) => x.emoji), ["❤️"]);
  r = await call("POST", `/message/${id}/react`, { token: seller.token, body: { emoji: "❤️" } });
  assert.equal(r.data.reactions.length, 0);

  // Outsiders can't touch it.
  const priya = await login("priya.sharma@example.com", "Seller123!").catch(() => null);
  if (priya) {
    assert.equal((await call("POST", `/message/${id}/react`, { token: priya.token, body: { emoji: "👍" } })).status, 403);
    assert.equal((await call("POST", `/message/${id}/translate`, { token: priya.token, body: { to: "en" } })).status, 403);
  }

  // Translation without an AI provider: a clear 503, never a 500.
  const t = await call("POST", `/message/${id}/translate`, { token: seller.token, body: { to: "pt" } });
  assert.ok([200, 503, 502].includes(t.status), `translate status ${t.status}`);
  assert.equal((await call("POST", `/message/${id}/translate`, { token: seller.token, body: { to: "xx" } })).status, 400);

  // Voice note: audio is accepted and stored locally.
  const audio = new Blob([Buffer.concat([Buffer.from("1A45DFA3", "hex"), Buffer.alloc(200)])], { type: "audio/webm;codecs=opus" });
  const v = await send(lucas, seller, "", { blob: audio, name: "voice.webm" });
  assert.equal(v.status, 201, JSON.stringify(v.data));
  assert.match(JSON.stringify(v.data.content.files), /\/uploads\/[0-9a-f]+\.webm/);

  // Context endpoint reports the other side's response time.
  const ctx = await call("GET", `/chat/${chatOf(sent.data)}/context`, { token: lucas.token });
  assert.equal(ctx.status, 200);
  assert.ok("responseTime" in ctx.data);
});

test("chat extras: away seller auto-replies once", async () => {
  const seller = await login("thiago.ribeiro@example.com", "Seller123!");
  const lucas = await login("lucas.muller@example.com", "Buyer123!");
  const until = new Date(Date.now() + 3 * 86400000).toISOString();
  assert.equal((await call("POST", "/users/profile", { token: seller.token, body: { availability: { away: true, until, message: "Away until Monday, will reply then." } } })).status, 200);
  try {
    const a = await send(lucas, seller, "Hello, are you there?");
    assert.equal(a.status, 201);
    await send(lucas, seller, "Second ping");
    await new Promise((r) => setTimeout(r, 800));
    const list = await call("GET", `/message/get-messages?chatId=${chatOf(a.data)}&limit=200`, { token: lucas.token });
    const autos = list.data.data.filter((m) => m.autoReply);
    // At most one auto-reply per conversation in 12h, sent as the seller.
    assert.equal(autos.length, 1);
    assert.equal(String(autos[0].sender?._id || autos[0].sender?.id || autos[0].sender), String(seller.user.id));
  } finally {
    await call("POST", "/users/profile", { token: seller.token, body: { availability: { away: false } } });
  }
});
