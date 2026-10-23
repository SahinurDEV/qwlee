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

test("pro: seller applies, moderator approves, badge + ?pro=true filter, concierge opens a ticket", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const mod = await login("moderator@example.com", "Admin123!");
  const sid = idOf(seller.user);
  try {
    assert.equal((await call("POST", "/pro/apply", { token: buyer.token, body: {} })).status, 403);
    assert.equal((await call("POST", "/pro/apply", { token: seller.token, body: { headline: "Senior full-stack engineer", experienceYears: 1, portfolioLinks: ["https://a.test", "https://b.test"] } })).status, 400);
    const ap = await call("POST", "/pro/apply", { token: seller.token, body: { headline: "Senior full-stack engineer", experienceYears: 8, portfolioLinks: ["https://a.test/1", "https://b.test/2"], clients: "Acme" } });
    assert.equal(ap.status, 201, JSON.stringify(ap.json));
    assert.equal(ap.data.application.status, "pending");
    assert.equal((await call("POST", "/pro/apply", { token: seller.token, body: {} })).status, 409);
    const list = await call("GET", "/admin/pro-applications", { token: mod.token });
    assert.ok(list.data.results.some((u) => idOf(u) === sid));
    const ok = await call("POST", `/admin/users/${sid}/pro`, { token: mod.token, body: { approve: true } });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal(ok.data.isPro, true);
    const pro = (await call("GET", "/gig?pro=true&limit=50")).data.results;
    assert.ok(pro.length > 0 && pro.every((g) => idOf(g.userId) === sid || g.userId?.isPro), "only Pro sellers' gigs");
    const c = await call("POST", "/pro/concierge", { token: buyer.token, body: { brief: "Need a senior React dev for a 3-month SaaS build", budget: "$10k", timeline: "Q1" } });
    assert.equal(c.status, 201, JSON.stringify(c.json));
    assert.ok(c.data.ticketId);
  } finally {
    await call("POST", `/admin/users/${sid}/pro`, { token: mod.token, body: { approve: false, note: "test reset" } });
  }
  assert.equal((await call("GET", "/pro/me", { token: seller.token })).data.isPro, false);
});
