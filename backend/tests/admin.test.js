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
  assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.json)}`);
  return { token: r.data.tokens.access.token, user: r.data.user };
};
const idOf = (v) => String(v?.id || v?._id || v || "");
const S = () => login("admin@example.com", "Admin123!");
const M = () => login("moderator@example.com", "Admin123!");
const F = () => login("finance@example.com", "Admin123!");

test("non-admins are blocked from admin routes, including the own-userId loophole", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const r = await call("PATCH", `/admin/seller-levels/${seller.user.id}/override`, { token: seller.token, body: { level: "top" } });
  assert.equal(r.status, 403);
  assert.equal((await call("GET", "/admin/users", { token: seller.token })).status, 403);
  assert.equal((await call("GET", "/withdrawal")).status, 401, "withdrawal list is not public");
});

test("admin sub-roles: permissions enforced and denials audited", async () => {
  const mod = await M();
  const fin = await F();
  const sup = await S();
  assert.equal((await call("GET", "/admin/settings/site", { token: mod.token })).status, 403);
  assert.equal((await call("GET", "/admin/audit", { token: fin.token })).status, 403);
  const orders = await call("GET", "/admin/payments?limit=50", { token: sup.token });
  assert.equal(orders.status, 200);
  const anyOrder = orders.data.results[0];
  assert.equal((await call("POST", `/admin/orders/${anyOrder.id}/refund`, { token: mod.token })).status, 403, "moderator cannot refund");
  const gigs = (await call("GET", "/gig?limit=1")).data.results;
  assert.equal((await call("PATCH", `/admin/gigs/${idOf(gigs[0])}/feature`, { token: fin.token, body: { featured: true } })).status, 403, "finance cannot feature");
  const audit = await call("GET", "/admin/audit?denied=true&limit=50", { token: sup.token });
  assert.equal(audit.status, 200);
  assert.ok(audit.data.results.some((a) => a.adminEmail === "moderator@example.com" && /refund/.test(a.action)), "denied refund logged");
});

test("super admin: feature + edit gig, edit user, view-as, sign out everywhere; actions audited with redaction", async () => {
  const sup = await S();
  const gig = (await call("GET", "/gig?limit=1")).data.results[0];
  const gid = idOf(gig);
  assert.equal((await call("PATCH", `/admin/gigs/${gid}/feature`, { token: sup.token, body: { featured: true } })).status, 200);
  const featured = await call("GET", "/gig?featured=true&limit=50");
  assert.ok(featured.data.results.some((g) => idOf(g) === gid));
  const edit = await call("PATCH", `/admin/gigs/${gid}`, { token: sup.token, body: { title: `${gig.title.slice(0, 60)} (edited)` } });
  assert.equal(edit.status, 200, JSON.stringify(edit.json));
  await call("PATCH", `/admin/gigs/${gid}/feature`, { token: sup.token, body: { featured: false } });

  const buyer = await login("buyer@example.com", "Buyer123!");
  const upd = await call("PATCH", `/admin/users/${buyer.user.id}`, { token: sup.token, body: { intro: "Edited by admin", password: "hunter22", role: "admin" } });
  assert.equal(upd.status, 200);
  assert.equal(upd.data.user.role, "buyer", "role is not editable through the profile endpoint");
  const view = await call("GET", `/admin/users/${buyer.user.id}/view`, { token: sup.token });
  assert.equal(view.status, 200);
  assert.equal(view.data.user.intro, "Edited by admin");
  assert.ok(Array.isArray(view.data.buying));

  await new Promise((r) => setTimeout(r, 1100)); // tokens carry 1-second iat
  assert.equal((await call("POST", `/admin/users/${buyer.user.id}/logout-all`, { token: sup.token })).status, 200);
  assert.equal((await call("GET", "/notification", { token: buyer.token })).status, 401, "old token revoked");
  await new Promise((r) => setTimeout(r, 1100));

  const audit = await call("GET", `/admin/audit?targetId=${buyer.user.id}&limit=20`, { token: sup.token });
  const row = audit.data.results.find((a) => a.action === "PATCH /admin/users/:id");
  assert.ok(row, "user edit audited");
  assert.equal(row.body.password, "[redacted]");
  assert.ok(audit.data.results.some((a) => a.action === "GET /admin/users/:id/view"), "view-as audited");
});

test("roles: only super can change roles; last super is protected", async () => {
  const sup = await S();
  const mod = await M();
  const buyer = await login("buyer@example.com", "Buyer123!");
  assert.equal((await call("PATCH", `/admin/users/${buyer.user.id}/role`, { token: mod.token, body: { role: "admin" } })).status, 403);
  assert.equal((await call("PATCH", `/admin/users/${sup.user.id}/role`, { token: sup.token, body: { role: "buyer" } })).status, 400, "cannot change own role");
  const team = await call("GET", "/admin/team", { token: sup.token });
  assert.ok(team.data.admins.some((a) => a.adminRole === "finance"));
});

test("site settings drive fee, feature toggles and the public config", async () => {
  const sup = await S();
  const orig = (await call("GET", "/admin/settings/site", { token: sup.token })).data.site;
  try {
    const bad = await call("PATCH", "/admin/settings/site", { token: sup.token, body: { marketplace: { feePercent: 80 } } });
    assert.equal(bad.status, 400);
    const r = await call("PATCH", "/admin/settings/site", {
      token: sup.token,
      body: { features: { signups: false }, homepage: { announcement: { enabled: true, text: "Maintenance tonight" } }, branding: { primaryColor: "#123456" } },
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const pub = await call("GET", "/info/site");
    assert.equal(pub.data.homepage.announcement.text, "Maintenance tonight");
    assert.equal(pub.data.features.signups, false);
    assert.equal(pub.data.marketplace, undefined, "internal settings not public");
    const reg = await call("POST", "/auth/register", { body: { fullName: "No Signup", email: `nosignup${Date.now()}@example.com`, password: "Passw0rd!", role: "buyer" } });
    assert.equal(reg.status, 403);
  } finally {
    await call("PATCH", "/admin/settings/site", { token: sup.token, body: orig });
  }
});

test("orders + payouts: force complete, refund, and admin-only withdrawal decisions", async () => {
  const fin = await F();
  const list = await call("GET", "/admin/payments?limit=100", { token: fin.token });
  assert.equal(list.status, 200);
  const open = list.data.results.filter((o) => ["active", "late"].includes(o.status) && !["released", "refunded"].includes(o.escrow?.status));
  assert.ok(open.length >= 2, "seed has open orders");
  const done = await call("POST", `/admin/orders/${open[0].id}/complete`, { token: fin.token });
  assert.equal(done.status, 200, JSON.stringify(done.json));
  assert.equal(done.data.order.escrow.status, "released");
  assert.equal((await call("POST", `/admin/orders/${open[0].id}/complete`, { token: fin.token })).status, 409);
  const ref = await call("POST", `/admin/orders/${open[1].id}/refund`, { token: fin.token, body: { reason: "Test refund" } });
  assert.equal(ref.status, 200, JSON.stringify(ref.json));
  assert.equal(ref.data.order.escrow.status, "refunded");
  assert.equal(ref.data.order.status, "cancelled");
  assert.equal((await call("POST", `/admin/orders/${open[1].id}/refund`, { token: fin.token })).status, 409);
  const esc = await call("GET", "/admin/escrow", { token: fin.token });
  assert.ok(esc.data.escrow.refunded.count >= 1);

  // The completed order credited its seller; use that balance for a payout.
  const seller = await login(open[0].freelancerId.email, "Seller123!");
  const balance = async () => (await call("GET", `/users/${seller.user.id}`, { token: seller.token })).data.user.balance;
  const before = await balance();
  assert.ok(before >= 20, `seller credited (${before})`);
  const w = await call("POST", "/withdrawal", { token: seller.token, body: { bankName: "Test Bank", accountNumber: "123", accountType: "savings", withdrawalAmount: 20, status: "Completed" } });
  assert.equal(w.status, 201, JSON.stringify(w.json));
  const wd = w.data?.withdrawal || w.data;
  assert.equal(wd.status, "Pending", "status cannot be set by the seller");
  const wid = idOf(wd);
  assert.equal((await call("PATCH", `/withdrawal/${wid}`, { token: seller.token })).status, 403, "seller cannot decline");
  assert.equal((await call("POST", `/withdrawal/${wid}`, { token: seller.token })).status, 403, "seller cannot approve");
  assert.equal((await call("PATCH", `/withdrawal/${wid}`, { token: fin.token, body: { reason: "test" } })).status, 200);
  assert.equal((await call("PATCH", `/withdrawal/${wid}`, { token: fin.token })).status, 409, "second decline rejected");
  assert.equal(Math.round((await balance()) * 100), Math.round(before * 100), "refunded exactly once");
});

test("broadcast reaches the audience as a notification", async () => {
  const mod = await M();
  const title = `Notice ${Date.now()}`;
  const r = await call("POST", "/admin/broadcast", { token: mod.token, body: { title, message: "Hello buyers", audience: "buyers" } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.ok(r.data.announcement.recipients > 0);
  const buyer = await login("buyer@example.com", "Buyer123!");
  const n = await call("GET", "/notification?limit=20", { token: buyer.token });
  const items = n.data?.results || n.data?.notifications?.results || n.data || [];
  assert.ok(JSON.stringify(items).includes(title), "buyer sees the announcement");
});

test("moderation: close requests, remove reviews; analytics series", async () => {
  const mod = await M();
  const reqs = await call("GET", "/admin/requests?status=open&limit=5", { token: mod.token });
  assert.equal(reqs.status, 200);
  if (reqs.data.results[0]) {
    const r = await call("PATCH", `/admin/requests/${reqs.data.results[0].id}`, { token: mod.token, body: { status: "closed" } });
    assert.equal(r.status, 200);
  }
  const reviews = await call("GET", "/admin/reviews?limit=5", { token: mod.token });
  assert.equal(reviews.status, 200);
  assert.ok(reviews.data.results.length > 0);
  assert.equal((await call("DELETE", `/admin/reviews/${reviews.data.results[0].id}`, { token: mod.token })).status, 200);
  const a = await call("GET", "/admin/analytics?days=30", { token: mod.token });
  assert.equal(a.status, 200);
  assert.equal(a.data.series.length, 30);
});
