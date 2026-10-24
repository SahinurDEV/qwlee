// Late orders: buyer self-cancel waits for "very late"; settings round-trip.
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

let admin, prev;
after(async () => {
  if (admin && prev) await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: prev } });
});

test("late order rules are admin settings and public", async () => {
  admin = await login("admin@example.com", "Admin123!");
  const m = (await call("GET", "/admin/settings/site", { token: admin.token })).data.site.marketplace;
  prev = { veryLateHours: m.veryLateHours, lateReminderDays: m.lateReminderDays, lateAutoCancelDays: m.lateAutoCancelDays };
  assert.deepEqual(prev, { veryLateHours: 24, lateReminderDays: 15, lateAutoCancelDays: 30 });
  const r = await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { veryLateHours: 100000 } } });
  assert.equal(r.status, 400);
  const ok = await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { veryLateHours: 720, lateAutoCancelDays: 0 } } });
  assert.equal(ok.status, 200);
  const pub = (await call("GET", "/info/site")).data;
  assert.equal(pub.orderRules.veryLateHours, 720);
  assert.equal(pub.orderRules.lateAutoCancelDays, 0);
});

test("buyer cannot self-cancel a late order before it is very late", async () => {
  const list = (await call("GET", "/admin/payments?limit=200", { token: admin.token })).data.results;
  const o = list.find((x) => x.status === "late" && x.delivery?.state !== "submitted");
  if (!o) return; // no late order in this dataset
  const buyerId = String(o.clientId?.id || o.clientId?._id || o.clientId);
  const emails = { };
  for (const [e, p] of [["buyer@example.com", "Buyer123!"], ["lucas.muller@example.com", "Buyer123!"]]) {
    const u = await login(e, p);
    emails[u.user.id] = u;
  }
  const buyer = emails[buyerId];
  if (!buyer) return;
  const r = await call("PATCH", `/orders?orderId=${o.id || o._id}`, { token: buyer.token, body: { status: "cancelled", reason: "too late" } });
  assert.equal(r.status, 409, JSON.stringify(r.json));
  assert.match(r.json.message, /hours past the due date/);
});
