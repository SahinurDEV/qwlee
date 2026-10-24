// Warnings escalate to a restriction; restricted sellers can't take new
// orders; lifting restores their gigs.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");

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
const idOf = (v) => String(v?.id || v?._id || v || "");

let admin, seller, warningIds = [];
after(async () => {
  if (!admin) return;
  await call("DELETE", `/admin/users/${seller.user.id}/restrict`, { token: admin.token });
  for (const id of warningIds) await call("DELETE", `/admin/warnings/${id}`, { token: admin.token });
});

test("two warnings for the same reason restrict the account", async () => {
  admin = await login("admin@example.com", "Admin123!");
  seller = await login("daniel.park@example.com", "Seller123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const gigsBefore = (await call("GET", "/gig?limit=200")).data.results.filter((g) => idOf(g.userId) === seller.user.id);
  assert.ok(gigsBefore.length > 0, "seller has live gigs");

  const bad = await call("POST", `/admin/users/${seller.user.id}/warnings`, { token: admin.token, body: { reason: "nope" } });
  assert.equal(bad.status, 400);
  const w1 = await call("POST", `/admin/users/${seller.user.id}/warnings`, { token: admin.token, body: { reason: "off_platform", note: "Shared a phone number" } });
  assert.equal(w1.status, 201, JSON.stringify(w1.json));
  assert.equal(w1.data.escalation, "");
  warningIds.push(idOf(w1.data.warning));
  const mine = await call("GET", "/users/me/standing", { token: seller.token });
  assert.equal(mine.data.warnings.length >= 1, true);
  assert.equal(mine.data.restriction, null);

  const w2 = await call("POST", `/admin/users/${seller.user.id}/warnings`, { token: admin.token, body: { reason: "off_platform" } });
  assert.equal(w2.data.escalation, "restricted");
  warningIds.push(idOf(w2.data.warning));
  const standing = await call("GET", "/users/me/standing", { token: seller.token });
  assert.ok(standing.data.restriction?.until, "restricted");

  // Gigs are hidden and new orders refused.
  const live = (await call("GET", "/gig?limit=200")).data.results.filter((g) => idOf(g.userId) === seller.user.id);
  assert.equal(live.length, 0);
  const g = gigsBefore[0];
  const q = await call("POST", "/orders/quote", { token: buyer.token, body: { gigId: idOf(g), packageName: g.package[0].name } });
  assert.ok([404, 409].includes(q.status), `quote ${q.status}`);

  // Lifting puts the gigs back.
  assert.equal((await call("DELETE", `/admin/users/${seller.user.id}/restrict`, { token: admin.token })).status, 200);
  const back = (await call("GET", "/gig?limit=200")).data.results.filter((x) => idOf(x.userId) === seller.user.id);
  assert.equal(back.length, gigsBefore.length);
});
