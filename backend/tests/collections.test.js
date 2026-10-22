// Saved-gig collections and recommendations.
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

test("collections: save, move, rename, delete keeps gigs saved; seller fields stay private", async () => {
  const token = await login("buyer@example.com", "Buyer123!");
  const gigs = (await call("GET", "/gig?limit=3")).data.results;
  const [a, b] = gigs.map((g) => g._id || g.id);
  const love = (await call("GET", "/gig/love?limit=200", { token })).data.results.map((x) => String(x.gigId?._id || x.gigId));
  for (const id of [a, b]) if (!love.includes(String(id))) assert.equal((await call("POST", `/gig/love?gigId=${id}`, { token })).status, 201);
  assert.equal((await call("POST", "/gig/love?gigId=000000000000000000000000", { token })).status, 404);

  const name = `Logos ${Date.now() % 100000}`;
  assert.equal((await call("PATCH", "/collections/item", { token, body: { gigId: a, collection: `  ${name}  ` } })).data.collection, name);
  const lists = (await call("GET", "/collections", { token })).data.results;
  assert.equal(lists.find((c) => c.name === name)?.count, 1);
  const inList = (await call("GET", `/gig/love?limit=200&collection=${encodeURIComponent(name)}`, { token })).data.results;
  assert.equal(inList.length, 1);
  const seller = inList[0].gigId.userId;
  assert.equal(seller.email, undefined, "seller email hidden");
  assert.equal(seller.balance, undefined, "seller balance hidden");

  const renamed = `${name} v2`;
  assert.equal((await call("PATCH", "/collections/rename", { token, body: { from: name, to: renamed } })).status, 200);
  assert.equal((await call("PATCH", "/collections/rename", { token, body: { from: "nope-x", to: "y" } })).status, 404);
  assert.equal((await call("DELETE", `/collections?name=${encodeURIComponent(renamed)}`, { token })).status, 200);
  const after = (await call("GET", "/gig/love?limit=200", { token })).data.results.find((x) => String(x.gigId?._id) === String(a));
  assert.ok(after, "still saved");
  assert.equal(after.collectionName, "");
  assert.equal((await call("DELETE", "/collections?name=", { token })).status, 400);
  // Another user can't move my saved gig.
  const seller2 = await login("seller@example.com", "Seller123!");
  assert.equal((await call("PATCH", "/collections/item", { token: seller2, body: { gigId: b, collection: "x" } })).status, 404);
  assert.equal((await call("GET", "/collections")).status, 401);
});

test("recommendations: public fallback, personal for a viewer with history, no own/saved gigs", async () => {
  const anon = await call("GET", "/collections/recommended");
  assert.equal(anon.status, 200);
  assert.ok(anon.data.results.length > 0);
  assert.ok(anon.data.results.every((g) => g.gigStatus === "active" && g.userId?.email === undefined));
  const someGig = anon.data.results[0];
  const seen = await call("GET", `/collections/recommended?seen=${someGig.id},bad-id`);
  assert.equal(seen.status, 200);
  assert.ok(!seen.data.results.some((g) => g.id === someGig.id), "seen gig itself not recommended");

  const token = await login("seller@example.com", "Seller123!");
  const me = (await call("POST", "/auth/login", { body: { email: "seller@example.com", password: "Seller123!" } })).data.user.id;
  const mine = await call("GET", "/collections/recommended?limit=24", { token });
  assert.ok(!mine.data.results.some((g) => String(g.userId?._id || g.userId?.id || g.userId) === me), "own gigs excluded");
});
