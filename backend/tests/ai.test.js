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
const mock = require("../src/utils/aiMock");

test("ai mock is deterministic and safe", () => {
  const a = mock.gigDescription({ title: "Build a <b>landing</b> page", skills: "React, CSS" });
  assert.equal(a, mock.gigDescription({ title: "Build a <b>landing</b> page", skills: "React, CSS" }));
  assert.ok(!a.includes("<b>") && a.includes("React"));
  assert.equal(mock.brief({ idea: "hi" }), null);
  assert.ok(mock.replySuggestions({ message: "What would it cost?" }).some((s) => /budget/.test(s)));
  assert.ok(mock.matchScore("react landing page", { skills: ["React"], intro: "Landing page expert" }) > mock.matchScore("react landing page", { skills: ["Excel"] }));
});

test("ai endpoints: auth required, mock fallback, owner-only matching", async () => {
  const status = (await call("GET", "/ai/status")).data;
  assert.equal(typeof status.enabled, "boolean");
  if (!status.enabled) return;
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  assert.equal((await call("POST", "/ai/brief", { body: { idea: "A logo for my bakery" } })).status, 401);
  const b = await call("POST", "/ai/brief", { token: buyer.token, body: { idea: "A logo for my bakery. Warm colours." } });
  assert.equal(b.status, 200);
  assert.equal(b.data.title, "A logo for my bakery");
  assert.equal((await call("POST", "/ai/gig-description", { token: seller.token, body: { title: "x" } })).status, 400);
  assert.ok((await call("POST", "/ai/gig-description", { token: seller.token, body: { title: "Logo design for small business" } })).data.text.length > 50);
  assert.ok((await call("POST", "/ai/replies", { token: seller.token, body: { message: "Thanks!" } })).data.suggestions.length >= 1);
  const web = (await call("GET", "/categories?limit=100")).data.results.find((c) => c.name === "Web Development");
  const req = (await call("POST", "/requests", { token: buyer.token, body: { title: `Match check ${Date.now()}`, description: "Need a React landing page with a contact form.", budget: 100, deliveryDays: 5, categoriesId: web.id } })).data;
  assert.equal((await call("GET", `/ai/match/${idOf(req)}`, { token: seller.token })).status, 403);
  const m = await call("GET", `/ai/match/${idOf(req)}`, { token: buyer.token });
  assert.equal(m.status, 200);
  assert.ok(Array.isArray(m.data.results) && m.data.results.every((r) => r.seller.email === undefined));
  await call("PATCH", `/requests/${idOf(req)}`, { token: buyer.token, body: { status: "closed" } });
});
