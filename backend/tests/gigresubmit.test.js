// Gig moderation: sent-back gigs can be resubmitted by the seller.
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
  assert.equal(r.status, 200);
  return { token: r.data.tokens.access.token, user: r.data.user };
};

let admin, gigId;
after(async () => {
  if (admin && gigId) await call("PATCH", `/admin/gigs/${gigId}/status`, { token: admin.token, body: { status: "active" } });
});

test("seller resubmits a gig after changes were requested", async () => {
  admin = await login("admin@example.com", "Admin123!");
  const seller = await login("thiago.ribeiro@example.com", "Seller123!");
  const mine = (await call("GET", "/gig/mine/stats", { token: seller.token })).data.gigs;
  const g = mine.find((x) => x.status === "active");
  assert.ok(g, "seller has an active gig");
  gigId = g._id || g.id;
  const sent = await call("PATCH", `/admin/gigs/${gigId}/status`, { token: admin.token, body: { status: "requires-modification", reason: "The gig is in the wrong category." } });
  assert.equal(sent.status, 200, JSON.stringify(sent.json));
  assert.equal((await call("PATCH", `/gig/${gigId}`, { token: seller.token, body: { gigStatus: "active" } })).status, 403);
  const re = await call("PATCH", `/gig/${gigId}`, { token: seller.token, body: { gigStatus: "pending" } });
  assert.equal(re.status, 200, JSON.stringify(re.json));
  const after1 = (await call("GET", "/gig/mine/stats", { token: seller.token })).data.gigs.find((x) => (x._id || x.id) === gigId);
  assert.equal(after1.status, "pending");
  assert.equal((await call("PATCH", `/gig/${gigId}`, { token: seller.token, body: { gigStatus: "pending" } })).status, 403);
});
