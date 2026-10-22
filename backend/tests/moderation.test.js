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

  return { token: r.data.tokens.access.token, user: r.data.user };
};

const EMAIL = "hannah.kim@example.com", PW = "Buyer123!";

test("temporary ban, appeal, accept lifts the ban", async () => {
  const mod = await login("moderator@example.com", "Admin123!");
  const fin = await login("finance@example.com", "Admin123!");
  const u = await login(EMAIL, PW);
  assert.ok(u.token, "test user can sign in");
  const id = u.user.id;
  // Leftover open appeal from an interrupted run.
  for (const x of (await call("GET", "/admin/appeals?status=open", { token: mod.token })).data.results)
    if ((x.userId?.id || x.userId?._id) === id) await call("PATCH", `/admin/appeals/${x.id}`, { token: mod.token, body: { decision: "accepted" } });
  try {
    assert.equal((await call("PATCH", `/admin/users/${id}/ban`, { token: mod.token, body: { reason: "Spam", days: 0 } })).status, 400);
    const b = await call("PATCH", `/admin/users/${id}/ban`, { token: mod.token, body: { reason: "Spam", days: 3 } });
    assert.equal(b.status, 200, JSON.stringify(b.json));
    const until = new Date(b.data.user.bannedUntil);
    assert.ok(Math.abs(until - Date.now() - 3 * 86400000) < 60000, "bannedUntil is 3 days out");
    const l = await call("POST", "/auth/login", { body: { email: EMAIL, password: PW } });
    assert.equal(l.status, 403);
    assert.match(l.json.message, /^BANNED:Spam[\s\S]*Suspended until/);
    assert.equal((await call("GET", "/notification", { token: u.token })).status, 401, "old token stops working");

    // Appeal with the token from the refused sign-in: forged/access tokens
    // and short text refused; one open appeal at a time.
    const appealToken = l.json.data.attributes.appealToken;
    assert.ok(appealToken);
    assert.equal((await call("POST", "/auth/appeal", { body: { appealToken: "forged", message: "x".repeat(30) } })).status, 401);
    assert.equal((await call("POST", "/auth/appeal", { body: { appealToken: mod.token, message: "x".repeat(30) } })).status, 401, "an access token is not an appeal token");
    assert.equal((await call("POST", "/auth/appeal", { body: { appealToken, message: "short" } })).status, 400);
    const a = await call("POST", "/auth/appeal", { body: { appealToken, message: "I was not spamming, these were replies to buyers." } });
    assert.equal(a.status, 201, JSON.stringify(a.json));
    assert.equal((await call("POST", "/auth/appeal", { body: { appealToken, message: "Second appeal while the first is open." } })).status, 409);

    assert.equal((await call("GET", "/admin/appeals", { token: fin.token })).status, 403, "finance can't review appeals");
    const list = await call("GET", "/admin/appeals?status=open", { token: mod.token });
    const mine = list.data.results.find((x) => x.id === a.data.id);
    assert.ok(mine && mine.banReason === "Spam");
    assert.equal((await call("PATCH", `/admin/appeals/${mine.id}`, { token: mod.token, body: { decision: "maybe" } })).status, 400);
    const d = await call("PATCH", `/admin/appeals/${mine.id}`, { token: mod.token, body: { decision: "accepted", reply: "Thanks, lifted." } });
    assert.equal(d.status, 200);
    assert.equal((await call("PATCH", `/admin/appeals/${mine.id}`, { token: mod.token, body: { decision: "rejected" } })).status, 409, "decided once");
    assert.equal((await call("POST", "/auth/login", { body: { email: EMAIL, password: PW } })).status, 200, "can sign in again");
    assert.equal((await call("POST", "/auth/appeal", { body: { appealToken, message: "Not banned any more, should be refused." } })).status, 400);
  } finally {
    await call("PATCH", `/admin/users/${id}/unban`, { token: mod.token });
  }
});

test("bulk actions: users and gigs", async () => {
  const mod = await login("moderator@example.com", "Admin123!");
  const sup = await login("admin@example.com", "Admin123!");
  const fin = await login("finance@example.com", "Admin123!");
  const u = await login(EMAIL, PW);
  const id = u.user.id;
  assert.equal((await call("POST", "/admin/bulk/users", { token: fin.token, body: { ids: [id], action: "logout" } })).status, 403);
  assert.equal((await call("POST", "/admin/bulk/users", { token: mod.token, body: { ids: [id], action: "explode" } })).status, 400);
  const lo = await call("POST", "/admin/bulk/users", { token: mod.token, body: { ids: [id, mod.user.id, "64b000000000000000000000"], action: "logout" } });
  assert.equal(lo.status, 200, JSON.stringify(lo.json));
  assert.equal(lo.data.done, 1);
  assert.equal(lo.data.failed, 2, "self and unknown user fail");
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal((await call("GET", "/notification", { token: u.token })).status, 401, "signed out");
  try {
    const ban = await call("POST", "/admin/bulk/users", { token: mod.token, body: { ids: [id, sup.user.id], action: "ban", reason: "Bulk test", days: 1 } });
    assert.equal(ban.data.done, 1);
    assert.match(ban.data.results.find((r) => r.id === sup.user.id).error, /Admins cannot be banned/);
    assert.equal((await call("POST", "/auth/login", { body: { email: EMAIL, password: PW } })).status, 403);
    const un = await call("POST", "/admin/bulk/users", { token: mod.token, body: { ids: [id], action: "unban" } });
    assert.equal(un.data.done, 1);
    assert.equal((await call("POST", "/auth/login", { body: { email: EMAIL, password: PW } })).status, 200);
  } finally {
    await call("PATCH", `/admin/users/${id}/unban`, { token: mod.token });
  }

  // Gigs: feature two, then unfeature them again.
  const gigs = (await call("GET", "/gig?limit=5")).data.results.filter((g) => !g.featured).slice(0, 2).map((g) => g.id || g._id);
  assert.equal((await call("POST", "/admin/bulk/gigs", { token: mod.token, body: { ids: gigs, action: "status", status: "bogus" } })).status, 400);
  const f = await call("POST", "/admin/bulk/gigs", { token: mod.token, body: { ids: gigs, action: "feature" } });
  assert.equal(f.status, 200);
  assert.equal(f.data.modified, gigs.length);
  const back = await call("POST", "/admin/bulk/gigs", { token: mod.token, body: { ids: gigs, action: "unfeature" } });
  assert.equal(back.data.modified, gigs.length);
});
