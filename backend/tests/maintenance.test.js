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
// Socket.IO over raw HTTP long-polling (no client library needed):
// open an Engine.IO session, send a namespace CONNECT ("40") and read
// back either CONNECT ("40{...}") or CONNECT_ERROR ("44{...}").
const SOCKET = (process.env.SOCKET_URL || API.replace(/:\d+(?=$|\/)/, ":8181")).replace(/\/+$/, "");
const socketConnect = async (token) => {
  const base = `${SOCKET}/socket.io/?EIO=4&transport=polling`;
  const open = await (await fetch(base)).text();
  const sid = JSON.parse(open.slice(open.indexOf("{"))).sid;
  await fetch(`${base}&sid=${sid}`, { method: "POST", body: "40" + JSON.stringify(token ? { token } : {}) });
  const reply = await (await fetch(`${base}&sid=${sid}`)).text();
  return reply;
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, `login ${email}`);
  return { token: r.data.tokens.access.token, user: r.data.user };
};

test("maintenance mode: 503 for non-admins, admins and sign-in keep working", async () => {
  const sup = await login("admin@example.com", "Admin123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const orig = (await call("GET", "/admin/settings/site", { token: sup.token })).data.site;
  try {
    assert.equal((await call("PATCH", "/admin/settings/site", { token: sup.token, body: { maintenance: { until: "not a date" } } })).status, 400);
    const until = new Date(Date.now() + 3600e3).toISOString();
    const on = await call("PATCH", "/admin/settings/site", { token: sup.token, body: { maintenance: { enabled: true, message: "Upgrading payments", until } } });
    assert.equal(on.status, 200, JSON.stringify(on.json));
    const anon = await call("GET", "/gig?limit=1");
    assert.equal(anon.status, 503);
    assert.match(anon.json.message, /^MAINTENANCE: Upgrading payments/);
    assert.equal((await call("GET", "/orders?limit=1", { token: buyer.token })).status, 503);
    assert.equal((await call("GET", "/gig?limit=1", { token: sup.token })).status, 200, "admins bypass");
    const pub = await call("GET", "/info/site");
    assert.equal(pub.status, 200);
    assert.equal(pub.data.maintenance.enabled, true);
    assert.equal(pub.data.maintenance.until, until);
    assert.equal((await login("buyer@example.com", "Buyer123!")).token ? 200 : 0, 200, "sign-in still works");
    assert.match(await socketConnect(buyer.token), /^44.*MAINTENANCE/, "chat refused for users");
    assert.match(await socketConnect(sup.token), /^40/, "admins keep chat");
  } finally {
    await call("PATCH", "/admin/settings/site", { token: sup.token, body: { ...orig, maintenance: { enabled: false, message: "", until: "" } } });
  }
  assert.equal((await call("GET", "/gig?limit=1")).status, 200);
  assert.match(await socketConnect(buyer.token), /^40/, "chat back after maintenance");
});
