// Success Score (1–10): formula, settings, seller/gig visibility.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { score } = require("../src/utils/successScore");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}/v1${path}`, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data?.attributes };
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, `login ${email}`);
  return { token: r.data.tokens.access.token, user: r.data.user };
};

test("formula: perfect = 10, all bad = 1, too few orders = null", () => {
  const good = Array.from({ length: 5 }, () => ({ status: "delivered", rating: 5, privateRating: 5, onTime: true, disputed: false }));
  assert.equal(score(good).score, 10);
  const bad = Array.from({ length: 5 }, () => ({ status: "cancelled", disputed: true }));
  assert.equal(score(bad).score, 1);
  assert.equal(score(good.slice(0, 4)).score, null);
  assert.equal(score(good.slice(0, 4), { minOrders: 1 }).score, 10);
});

test("formula: weights rescale over signals with data", () => {
  const rows = [
    ...Array.from({ length: 4 }, () => ({ status: "delivered", rating: 5, onTime: true })),
    { status: "delivered", rating: 1, onTime: false },
  ];
  const r = score(rows, { weights: { privateRating: 30, rating: 50, completion: 0, onTime: 50, noDisputes: 0 } });
  // rating avg 4.2 -> 0.8, onTime 0.8 -> 1 + 9*0.8 = 8.2 -> 8
  assert.equal(r.score, 8);
  assert.equal(r.signals.privateRating, null);
  assert.equal(r.signals.onTime, 80);
});

let admin, prev;
after(async () => {
  if (admin && prev) await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: prev } });
});

test("settings are admin-configurable and validated", async () => {
  admin = await login("admin@example.com", "Admin123!");
  const m = (await call("GET", "/admin/settings/site", { token: admin.token })).data.site.marketplace;
  prev = { successScoreDays: m.successScoreDays, successScoreMinOrders: m.successScoreMinOrders, successScoreWeights: m.successScoreWeights };
  assert.equal(m.successScoreDays, 90);
  assert.equal(m.successScoreWeights.privateRating, 30);
  assert.equal((await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { successScoreDays: 1 } } })).status, 400);
  const ok = await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { successScoreMinOrders: 1, successScoreWeights: { ...m.successScoreWeights, onTime: 40 } } } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  const after = (await call("GET", "/admin/settings/site", { token: admin.token })).data.site.marketplace;
  assert.equal(after.successScoreWeights.onTime, 40);
  assert.equal(after.successScoreMinOrders, 1);
});

test("seller sees score on level overview and own gigs; others can't read a gig's score", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const lvl = await call("GET", "/gig/mine/level", { token: seller.token });
  assert.equal(lvl.status, 200);
  assert.ok(lvl.data.success && "signals" in lvl.data.success, "success block");
  const s = lvl.data.metrics.successScore;
  assert.ok(s === null || (s >= 1 && s <= 10), `score ${s}`);
  for (const t of lvl.data.tiers) assert.ok(t.minSuccessScore >= 0 && t.minSuccessScore <= 10);

  const mine = (await call("GET", "/gig/mine/stats", { token: seller.token })).data.gigs;
  assert.ok(mine.length > 0);
  assert.ok("successScore" in mine[0]);
  const gid = mine[0].id || mine[0]._id;
  const own = await call("GET", `/gig/${gid}/success-score`, { token: seller.token });
  assert.equal(own.status, 200);
  assert.ok("score" in own.data);
  const buyer = await login("buyer@example.com", "Buyer123!");
  assert.equal((await call("GET", `/gig/${gid}/success-score`, { token: buyer.token })).status, 403);
  assert.equal((await call("GET", `/gig/${gid}/success-score`)).status, 401);
  assert.equal((await call("GET", `/gig/${gid}/success-score`, { token: admin.token })).status, 200);

  const list = await call("GET", "/admin/seller-levels", { token: admin.token });
  if (list.status === 200) {
    const rows = list.data.results || list.data.sellers || list.data;
    if (Array.isArray(rows) && rows.length) assert.ok("successScore" in rows[0].stats);
  }
});
