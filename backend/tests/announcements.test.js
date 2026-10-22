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

test("announcements: targeting preview, scheduling, cancel, send when due", async () => {
  const sup = await login("admin@example.com", "Admin123!");
  const mod = await login("moderator@example.com", "Admin123!");
  const fin = await login("finance@example.com", "Admin123!");
  const buyer = await login("buyer@example.com", "Buyer123!");

  const all = (await call("POST", "/admin/broadcast/preview", { token: mod.token, body: { audience: "all" } })).data.count;
  const sellers = (await call("POST", "/admin/broadcast/preview", { token: mod.token, body: { audience: "sellers" } })).data.count;
  const ordered = (await call("POST", "/admin/broadcast/preview", { token: mod.token, body: { audience: "buyers", target: { hasOrdered: "yes" } } })).data.count;
  const never = (await call("POST", "/admin/broadcast/preview", { token: mod.token, body: { audience: "buyers", target: { hasOrdered: "no" } } })).data.count;
  const buyers = (await call("POST", "/admin/broadcast/preview", { token: mod.token, body: { audience: "buyers" } })).data.count;
  assert.ok(all > sellers && sellers > 0);
  assert.equal(ordered + never, buyers, "ordered + never ordered = all buyers");
  const loc = await call("POST", "/admin/broadcast/preview", { token: mod.token, body: { target: { location: "(bangladesh" } } });
  assert.equal(loc.status, 200, "regex characters are escaped");
  assert.equal((await call("POST", "/admin/broadcast/preview", { token: fin.token, body: {} })).status, 403);

  // Schedule one for the demo buyer's segment, then cancel it.
  const tag = `T${Date.now()}`;
  const when = new Date(Date.now() + 3600000).toISOString();
  const bad = await call("POST", "/admin/broadcast", { token: mod.token, body: { title: "x", message: "y", sendAt: "not a date" } });
  assert.equal(bad.status, 400);
  const c1 = await call("POST", "/admin/broadcast", { token: mod.token, body: { title: `Cancel me ${tag}`, message: "Should never arrive", audience: "buyers", sendAt: when } });
  assert.equal(c1.status, 201, JSON.stringify(c1.json));
  assert.equal(c1.data.announcement.status, "scheduled");
  const id1 = c1.data.announcement.id;
  assert.equal((await call("POST", `/admin/broadcast/${id1}/cancel`, { token: mod.token })).status, 200);
  assert.equal((await call("POST", `/admin/broadcast/${id1}/cancel`, { token: mod.token })).status, 409);

  // Schedule another, edit it, run the job "an hour from now": it is sent once.
  const c2 = await call("POST", "/admin/broadcast", { token: mod.token, body: { title: `Scheduled ${tag}`, message: "Hello buyers", audience: "buyers", target: { location: "" }, sendAt: when } });
  const id2 = c2.data.announcement.id;
  const ed = await call("PATCH", `/admin/broadcast/${id2}`, { token: mod.token, body: { message: "Hello again buyers" } });
  assert.equal(ed.status, 200, JSON.stringify(ed.json));
  assert.equal((await call("POST", "/admin/jobs/announcements", { token: mod.token, body: {} })).status, 403, "super only");
  assert.equal((await call("POST", "/admin/jobs/announcements", { token: sup.token, body: {} })).data.sent, 0, "not due yet");
  const run = await call("POST", "/admin/jobs/announcements", { token: sup.token, body: { asOf: new Date(Date.now() + 2 * 3600000).toISOString() } });
  assert.ok(run.data.sent >= 1);
  assert.equal((await call("PATCH", `/admin/broadcast/${id2}`, { token: mod.token, body: { message: "too late" } })).status, 409);
  const notes = (await call("GET", "/notification?limit=50", { token: buyer.token })).json;
  const txt = JSON.stringify(notes);
  assert.ok(txt.includes(`Scheduled ${tag}: Hello again buyers`), "buyer got the edited text");
  assert.ok(!txt.includes(`Cancel me ${tag}`), "cancelled one was not sent");
  const listed = (await call("GET", "/admin/broadcast?limit=20", { token: mod.token })).data.results.find((a) => a.id === id2);
  assert.equal(listed.status, "sent");
  assert.equal(listed.recipients, buyers);
});
