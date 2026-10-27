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

test("admin disputes list populates order and initiator (paginate comma-split)", async () => {
  const admin = await login("admin@example.com", "Admin123!");
  const buyer = await login("buyer@example.com", "Buyer123!");

  let list = await call("GET", "/disputes?limit=20", { token: admin.token });
  if (list.status === 200 && (list.data.results || []).length === 0) {
    const orders = await call("GET", "/orders?limit=50", { token: buyer.token });
    assert.equal(orders.status, 200, `orders list ${orders.status}`);
    const order = (orders.data?.results || []).find((o) =>
      ["active", "delivered", "late"].includes(o.status)
    );
    assert.ok(order, "need a buyer order to open a dispute");
    const opened = await call("POST", "/disputes", {
      token: buyer.token,
      body: {
        orderId: idOf(order),
        reasonCode: "low_quality",
        description: "Paginate populate regression — seeded for admin list test.",
      },
    });
    assert.ok([201, 400].includes(opened.status), `open dispute ${opened.status}`);
    list = await call("GET", "/disputes?limit=20", { token: admin.token });
  }

  assert.equal(list.status, 200, `admin list status ${list.status} body=${JSON.stringify(list.json)}`);
  assert.ok(Array.isArray(list.data.results), "results array");
  assert.ok(list.data.results.length >= 1, "at least one dispute");

  const row = list.data.results[0];
  assert.equal(typeof row.orderId, "object", "orderId populated");
  assert.ok(row.orderId && (row.orderId._id || row.orderId.id), "order has id");
  assert.equal(typeof row.initiatorId, "object", "initiatorId populated");
  assert.ok(
    row.initiatorId &&
      (row.initiatorId.fullName || row.initiatorId.username || row.initiatorId.email || row.initiatorId._id)
  );
});

test("buyer cannot list all disputes; my disputes still works", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  assert.equal((await call("GET", "/disputes", { token: buyer.token })).status, 403);
  const mine = await call("GET", "/disputes/my?limit=10", { token: buyer.token });
  assert.equal(mine.status, 200);
  assert.ok(Array.isArray(mine.data.results));
});
