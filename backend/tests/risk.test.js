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

const send = async (token, receiver, message) => {
  const f = new FormData();
  f.append("message", message);
  f.append("receiver", receiver);
  const r = await fetch(`${API}/v1/message/add-message`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: f });
  const j = await r.json().catch(() => null);
  return { status: r.status, data: j?.data?.attributes ?? j?.data };
};

test("risk: blocked words refuse, flagged words and contact details open flags", async () => {
  const sup = await login("admin@example.com", "Admin123!");
  const mod = await login("moderator@example.com", "Admin123!");
  const fin = await login("finance@example.com", "Admin123!");
  const seller = await login("seller@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const before = (await call("GET", "/admin/settings/site", { token: sup.token })).data;
  const prev = before?.site?.moderation;
  try {
    const set = await call("PATCH", "/admin/settings/site", { token: sup.token, body: { moderation: { blockedWords: "zzbadword, very bad phrase", flaggedWords: ["zzsuspect"], flagContactInfo: true } } });
    assert.equal(set.status, 200, JSON.stringify(set.json));

    // Blocked: whole word, any case, phrases with flexible spaces. Not inside other words.
    assert.equal((await send(seller.token, buyer.user.id, "This is a ZZBADWORD here")).status, 400);
    assert.equal((await send(seller.token, buyer.user.id, "a very  bad phrase indeed")).status, 400);
    const inner = await send(seller.token, buyer.user.id, "notzzbadwordatall is fine");
    assert.equal(inner.status, 201, "substring of a longer word is not blocked");

    // Flagged word plus contact details: delivered, and flagged.
    const tag = `t${Date.now()}`;
    const m = await send(seller.token, buyer.user.id, `zzsuspect ${tag} write me on WhatsApp or mail me at someone@example.org`);
    assert.equal(m.status, 201);
    const mid = String(m.data._id || m.data.id);
    const flags = await call("GET", "/admin/risk-flags?status=open&kind=message", { token: mod.token });
    assert.equal(flags.status, 200);
    const f = flags.data.results.find((x) => x.targetId === mid);
    assert.ok(f, "flag opened for the message");
    const reasons = new Set(f.reasons || []);
    for (const need of ["contact:email", "contact:messenger", "keyword:zzsuspect"]) {
      assert.ok(reasons.has(need), `missing reason ${need} in ${[...reasons]}`);
    }
    assert.match(f.excerpt, new RegExp(tag));

    // Buyer request with a blocked word is refused; a gig update too.
    const cats = (await call("GET", "/categories?limit=100")).data?.results || [];
    const req = await call("POST", "/requests", { token: buyer.token, body: { title: "Need a zzbadword logo design", description: "Looking for a clean logo for my bakery business.", budget: 50, deliveryDays: 5, categoriesId: cats[0]?.id } });
    assert.equal(req.status, 400);
    assert.match(req.json.message, /isn't allowed/);

    // Review: moderator can dismiss; finance can't see the queue.
    assert.equal((await call("GET", "/admin/risk-flags", { token: fin.token })).status, 403);
    const id = f.id || f._id;
    assert.equal((await call("PATCH", `/admin/risk-flags/${id}`, { token: mod.token, body: { status: "nope" } })).status, 400);
    const done = await call("PATCH", `/admin/risk-flags/${id}`, { token: mod.token, body: { status: "dismissed", note: "test" } });
    assert.equal(done.status, 200);
    assert.equal(done.data.status, "dismissed");
    assert.ok(!(await call("GET", "/admin/risk-flags?status=open&kind=message", { token: mod.token })).data.results.some((x) => x.targetId === mid));
  } finally {
    await call("PATCH", "/admin/settings/site", { token: sup.token, body: { moderation: prev || { blockedWords: [], flaggedWords: [] } } });
  }
});

test("risk: word matching", () => {
  const { wordRe } = require("../src/services/risk.service");
  assert.ok(wordRe("scam").test("total SCAM!"));
  assert.ok(!wordRe("scam").test("scampi"));
  assert.ok(wordRe("pay outside").test("can we pay\noutside"));
  assert.ok(wordRe("c++").test("i know c++ well"));
});

test("risk: phone pattern ignores ids glued to letters", () => {
  const { CONTACT } = require("../src/services/risk.service");
  const phone = CONTACT.find(([k]) => k === "contact:phone")[1];
  assert.ok(phone.test("call +880 1712-345678"));
  assert.ok(!phone.test("ref t1761234567890 ok"));
});

test("risk: a large order from a new account opens a flag", async (t) => {
  const sup = await login("admin@example.com", "Admin123!");
  const mod = await login("moderator@example.com", "Admin123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  if (buyer.user.createdAt && Date.now() - new Date(buyer.user.createdAt) > 2 * 86400000) return t.skip("demo buyer is not a new account (re-seed to run)");
  const before = (await call("GET", "/admin/settings/site", { token: sup.token })).data;
  const prev = before?.site?.moderation;
  try {
    await call("PATCH", "/admin/settings/site", { token: sup.token, body: { moderation: { riskOrderAmount: 5 } } });
    const mine = (await call("GET", "/gig/mine/stats", { token: seller.token })).data.gigs.map((g) => String(g.id || g._id));
    const gig = (await call("GET", "/gig?limit=100")).data.results.find((g) => mine.includes(String(g.id || g._id)));
    const r = await call("POST", "/orders/checkout", { token: buyer.token, body: { gigId: gig.id || gig._id, packageName: gig.package[0].name } });
    if (r.status === 503) return t.skip("payments not configured");
    assert.equal(r.status, 200, JSON.stringify(r.json));
    let flag;
    for (let i = 0; i < 10 && !flag; i++) {
      await new Promise((ok) => setTimeout(ok, 200));
      flag = (await call("GET", "/admin/risk-flags?kind=order&status=all", { token: mod.token })).data.results.find((f) => f.targetId === String(r.json.orderId));
    }
    assert.ok(flag, "order flagged");
    assert.ok(flag.reasons.includes("new-account-large-order"));
    await call("PATCH", `/admin/risk-flags/${flag.id}`, { token: mod.token, body: { status: "dismissed" } });
  } finally {
    await call("PATCH", "/admin/settings/site", { token: sup.token, body: { moderation: { riskOrderAmount: prev?.riskOrderAmount ?? 500 } } });
  }
});
