// Reminder emails: review window closing and funds cleared. Both also
// leave an in-app notification, are sent once, and have admin toggles.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const MAILPIT = (process.env.MAILPIT_URL || "http://localhost:8025").replace(/\/+$/, "");
const call = async (method, path, { token, body, form } = {}) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: { ...(form ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data?.attributes };
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, `login ${email}`);
  return { token: r.data.tokens.access.token, user: r.data.user };
};
const mails = async (q) => (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(q)}&limit=200`).then((r) => r.json())).messages || [];

let admin, prev, mongoose;
after(async () => {
  if (admin && prev) await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: prev } });
  if (mongoose) await mongoose.disconnect();
});

test("reminder settings round-trip", async () => {
  admin = await login("admin@example.com", "Admin123!");
  const m = (await call("GET", "/admin/settings/site", { token: admin.token })).data.site.marketplace;
  prev = { clearanceDays: m.clearanceDays, reviewWindowDays: m.reviewWindowDays, reviewReminderDays: m.reviewReminderDays, fundsClearedEmail: m.fundsClearedEmail };
  assert.equal(m.reviewReminderDays, 2);
  assert.equal(m.fundsClearedEmail, true);
  assert.equal((await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { reviewReminderDays: 99 } } })).status, 400);
});

test("review-closing and funds-cleared reminders go out once", async (t) => {
  const up = await fetch(`${MAILPIT}/api/v1/messages?limit=1`).then((r) => r.ok).catch(() => false);
  if (!up || !process.env.MONGODB_URL) return t.skip("needs Mailpit and the test database");
  await call("PATCH", "/admin/settings/site", { token: admin.token, body: { marketplace: { clearanceDays: 14, reviewWindowDays: 14, reviewReminderDays: 2, fundsClearedEmail: true } } });
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  const mine = (await call("GET", "/gig/mine/stats", { token: seller.token })).data.gigs.map((g) => g.id || g._id);
  const gig = (await call("GET", "/gig?limit=100")).data.results.find((g) => mine.includes(g.id || g._id));
  const pkg = gig.package[0];
  const r = await call("POST", "/orders/checkout", { token: buyer.token, body: { gigId: gig.id || gig._id, packageName: pkg.name, price: 1, items: [{ name: "x", price: 1, quantity: 1 }] } });
  if (r.status === 503) return t.skip("payments not configured");
  const id = r.json.orderId;
  await call("POST", `/orders/${id}/requirements`, { token: buyer.token, body: { answers: [{ question: "q1", answer: "A landing page for my bakery" }, { question: "q2", answer: "" }] } });
  const form = new FormData();
  form.append("orderId", id);
  form.append("deliveryMessage", "Done");
  form.append("receiver", buyer.user.id);
  assert.equal((await call("POST", "/order-message", { token: seller.token, form })).status, 201);
  assert.equal((await call("POST", `/orders/${id}/accept`, { token: buyer.token })).status, 200);

  // Move time: the order finished 13 days ago and its earnings are due.
  mongoose = require("mongoose");
  await mongoose.connect(process.env.MONGODB_URL);
  const db = mongoose.connection.db;
  const oid = new mongoose.Types.ObjectId(String(id));
  await db.collection("payments").updateOne({ _id: oid }, { $set: { completedAt: new Date(Date.now() - 13 * 86400e3) } });
  await db.collection("clearances").updateOne({ ref: String(id), status: "pending" }, { $set: { availableAt: new Date(Date.now() - 1000) } });

  for (let i = 0; i < 2; i++) assert.equal((await call("POST", "/admin/jobs/housekeeping", { token: admin.token })).status < 300, true);

  const o = await db.collection("payments").findOne({ _id: oid });
  assert.ok(o.reviewReminderAt, "reminder stamped");
  const notes = await db.collection("notifications").find({ linkId: { $in: [String(id), oid] } }).toArray();
  assert.ok(notes.some((n) => /left to review/.test(n.message)), "buyer in-app reminder");
  assert.equal(notes.filter((n) => /left to review/.test(n.message)).length, 1, "only once");
  const cleared = await db.collection("notifications").find({ receiverId: new mongoose.Types.ObjectId(seller.user.id), message: /cleared/ }).toArray();
  assert.ok(cleared.length >= 1, "seller in-app funds notice");

  let rev = [], fund = [];
  for (let i = 0; i < 20; i++) {
    rev = (await mails(`to:buyer@example.com subject:"left to review"`)).filter((m) => /left to review/.test(m.Subject));
    fund = (await mails(`to:seller@example.com subject:"ready to withdraw"`));
    if (rev.length && fund.length) break;
    await new Promise((res) => setTimeout(res, 500));
  }
  assert.equal(rev.length, 1, "one review reminder email");
  assert.ok(fund.length >= 1, "funds cleared email");
});
