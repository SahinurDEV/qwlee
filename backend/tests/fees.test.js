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

test("category fees: validated, and a completed order in that category pays the override", async () => {
  const sup = await login("admin@example.com", "Admin123!");
  const orig = (await call("GET", "/admin/settings/site", { token: sup.token })).data.site;
  try {
    const bad = [
      [{ categoryId: "nope", percent: 5 }],
      [{ categoryId: "0123456789abcdef01234567", percent: 80 }],
      [{ categoryId: "0123456789abcdef01234567", percent: 5 }, { categoryId: "0123456789abcdef01234567", percent: 6 }],
    ];
    for (const categoryFees of bad) assert.equal((await call("PATCH", "/admin/settings/site", { token: sup.token, body: { marketplace: { categoryFees } } })).status, 400);
    const list = await call("GET", "/admin/payments?limit=100", { token: sup.token });
    const open = list.data.results.filter((o) => ["active", "late"].includes(o.status) && !["released", "refunded"].includes(o.escrow?.status));
    if (!open.length) return;
    const order = open[open.length - 1];
    const gigId = order.gigId?.id || order.gigId?._id || order.gigId;
    const gig = await call("GET", `/gig/${gigId}`);
    const g = gig.data.gig || gig.data;
    const cat = g.categoriesId?.id || g.categoriesId?._id || g.categoriesId;
    assert.ok(cat, "gig has a category");
    const r = await call("PATCH", "/admin/settings/site", { token: sup.token, body: { marketplace: { categoryFees: [{ categoryId: String(cat), percent: 12.5 }] } } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(r.data.site.marketplace.categoryFees, [{ categoryId: String(cat), percent: 12.5 }]);
    const done = await call("POST", `/admin/orders/${order.id}/complete`, { token: sup.token });
    assert.equal(done.status, 200, JSON.stringify(done.json));
    assert.equal(done.data.order.platformFeePercent, 12.5);
    const gross = Number(done.data.order.platformFee) + Number(done.data.order.sellerEarning);
    assert.ok(Math.abs(Number(done.data.order.platformFee) - Math.round(gross * 12.5) / 100) <= 0.02, "fee is 12.5%");
  } finally {
    await call("PATCH", "/admin/settings/site", { token: sup.token, body: orig });
  }
});
