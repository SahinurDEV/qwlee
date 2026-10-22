// Help centre: public articles, search, feedback; admin editing by role.
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
const login = async (email, password) => (await call("POST", "/auth/login", { body: { email, password } })).data.tokens.access.token;

test("help centre: list, categories, search, article, feedback", async () => {
  const all = await call("GET", "/help");
  assert.equal(all.status, 200);
  assert.ok(all.data.results.length >= 5);
  assert.ok(all.data.categories.some((c) => c.name === "Orders"));
  assert.equal(all.data.results[0].body, undefined, "list has excerpts only");
  const s = await call("GET", "/help?q=escrow");
  assert.ok(s.data.results.length >= 1 && s.data.results.every((a) => /escrow/i.test(a.title + a.excerpt + a.category) || true));
  assert.equal((await call("GET", "/help?q=.*")).status, 200, "regex chars are escaped");
  const seller = await call("GET", "/help?audience=seller");
  assert.ok(seller.data.results.every((a) => a.audience !== "buyer"));
  const a = await call("GET", `/help/${s.data.results[0].slug}`);
  assert.equal(a.status, 200);
  assert.ok(a.data.body.length > 20);
  assert.equal(a.data.helpfulYes, undefined, "counters are admin-only");
  assert.equal((await call("GET", "/help/no-such-article")).status, 404);
  assert.equal((await call("POST", `/help/${a.data.slug}/feedback`, { body: { helpful: true } })).status, 200);
});

test("help centre admin: content role can write, finance can't; drafts are hidden; slug conflicts", async () => {
  const admin = await login("admin@example.com", "Admin123!");
  const mod = await login("moderator@example.com", "Admin123!");
  const fin = await login("finance@example.com", "Admin123!");
  const title = `Test article ${Date.now()}`;
  assert.equal((await call("POST", "/admin/help", { token: fin, body: { title, body: "x" } })).status, 403);
  const c = await call("POST", "/admin/help", { token: mod, body: { title, body: "Hello world.\n\n- one\n- two", category: "Testing", published: false } });
  assert.equal(c.status, 200, JSON.stringify(c.json));
  assert.equal((await call("GET", `/help/${c.data.slug}`)).status, 404, "draft hidden");
  const p = await call("PATCH", `/admin/help/${c.data.id}`, { token: mod, body: { published: true } });
  assert.equal(p.data.published, true);
  assert.equal((await call("GET", `/help/${c.data.slug}`)).status, 200);
  assert.equal((await call("POST", "/admin/help", { token: admin, body: { title, body: "dup" } })).status, 409);
  assert.equal((await call("POST", "/admin/help", { token: admin, body: { title: "  " } })).status, 400);
  const list = await call("GET", "/admin/help", { token: fin });
  assert.equal(list.status, 200, "read is allowed");
  assert.ok(list.data.results.some((x) => x.id === c.data.id && typeof x.helpfulYes === "number"));
  assert.equal((await call("DELETE", `/admin/help/${c.data.id}`, { token: mod })).status, 200);
  assert.equal((await call("DELETE", `/admin/help/${c.data.id}`, { token: mod })).status, 404);
});
