// Notification preferences, email opt-out, and the web push plumbing.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const MAILPIT = (process.env.MAILPIT_URL || "http://localhost:8025").replace(/\/+$/, "");
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

test("notification settings: defaults, partial update, locked payment email, private", async () => {
  const token = await login("buyer@example.com", "Buyer123!");
  assert.equal((await call("GET", "/notification-settings")).status, 401);
  const g = await call("GET", "/notification-settings", { token });
  assert.equal(g.status, 200);
  assert.equal(g.data.prefs.email.orders, true);
  assert.equal(g.data.prefs.push.messages, true);
  assert.ok(g.data.categories.marketing);
  assert.equal(typeof g.data.push.enabled, "boolean");
  const u = await call("PATCH", "/notification-settings", { token, body: { email: { marketing: false, payments: false, bogus: false }, push: { orders: "no" } } });
  assert.equal(u.status, 200);
  assert.equal(u.data.prefs.email.marketing, false);
  assert.equal(u.data.prefs.email.payments, true, "payment emails can't be turned off");
  assert.equal(u.data.prefs.push.orders, true, "non-boolean ignored");
  assert.equal(u.data.prefs.email.bogus, undefined);
  const me = await call("POST", "/auth/login", { body: { email: "buyer@example.com", password: "Buyer123!" } });
  assert.equal(JSON.stringify(me.json || {}).includes("notificationPrefs"), false, "prefs are not exposed on the user object");
  await call("PATCH", "/notification-settings", { token, body: { email: { marketing: true } } });
});

test("email opt-out: an announcement is not emailed to a user who turned marketing off", async (t) => {
  const up = await fetch(`${MAILPIT}/api/v1/messages?limit=1`).then((r) => r.ok).catch(() => false);
  if (!up) return t.skip("Mailpit not reachable");
  const admin = await login("admin@example.com", "Admin123!");
  const buyer = await login("buyer@example.com", "Buyer123!");
  const seller = await login("seller@example.com", "Seller123!");
  await call("PATCH", "/notification-settings", { token: buyer, body: { email: { marketing: false } } });
  await call("PATCH", "/notification-settings", { token: seller, body: { email: { marketing: true } } });
  const title = `Prefs test ${Date.now()}`;
  try {
    const b = await call("POST", "/admin/broadcast", { token: admin, body: { title, message: "hello", audience: "all", sendEmail: true } });
    assert.ok(b.status < 300, JSON.stringify(b.json));
    let found = [];
    for (let i = 0; i < 20; i++) {
      const s = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`subject:"${title}"`)}&limit=500`).then((r) => r.json());
      found = (s.messages || []).flatMap((m) => m.To.map((x) => x.Address));
      if (found.includes("seller@example.com")) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(found.includes("seller@example.com"), "opted-in user got it");
    assert.ok(!found.includes("buyer@example.com"), "opted-out user did not");
  } finally {
    await call("PATCH", "/notification-settings", { token: buyer, body: { email: { marketing: true } } });
  }
});

test("push: config is public, unknown push hosts and bad keys are refused", async () => {
  const cfg = await call("GET", "/notification-settings/push");
  assert.equal(cfg.status, 200);
  assert.equal(typeof cfg.data.enabled, "boolean");
  const token = await login("buyer@example.com", "Buyer123!");
  const ecdh = require("node:crypto").createECDH("prime256v1");
  ecdh.generateKeys();
  const keys = { p256dh: ecdh.getPublicKey().toString("base64url"), auth: require("node:crypto").randomBytes(16).toString("base64url") };
  for (const endpoint of ["http://fcm.googleapis.com/fcm/send/x", "https://127.0.0.1/x", "https://evil.example.com/x", "https://fcm.googleapis.com.evil.com/x", "https://fcm.googleapis.com:8443/x"]) {
    const r = await call("POST", "/notification-settings/push/subscribe", { token, body: { endpoint, keys } });
    assert.equal(r.status, 400, endpoint);
  }
  assert.equal((await call("POST", "/notification-settings/push/subscribe", { token, body: { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "B".repeat(87), auth: keys.auth } } })).status, 400, "point not on the curve");
  const endpoint = `https://fcm.googleapis.com/fcm/send/test-${Date.now()}`;
  const ok = await call("POST", "/notification-settings/push/subscribe", { token, body: { endpoint, keys } });
  ok.endpoint = endpoint;
  assert.equal(ok.status, 200);
  assert.ok(ok.data.devices >= 1);
  const off = await call("POST", "/notification-settings/push/unsubscribe", { token, body: { endpoint: ok.endpoint } });
  assert.equal(off.status, 200);
});

test("web push wire format: VAPID-signed, encrypted request; dead subscriptions detected", async () => {
  const wp = require("../src/utils/webpush");
  const webpush = require("web-push");
  const crypto = require("node:crypto");
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") } };
  const keys = { ...wp.generateVAPIDKeys(), subject: "mailto:test@example.com" };
  const d = wp.requestDetails(sub, { title: "Hi", body: "there" }, keys);
  assert.equal(d.method, "POST");
  assert.equal(d.endpoint, sub.endpoint);
  assert.equal(d.headers["Content-Encoding"], "aes128gcm");
  assert.match(d.headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
  assert.ok(d.body.length > 20 && !d.body.toString().includes("there"), "payload is encrypted");

  const real = webpush.sendNotification;
  try {
    webpush.sendNotification = async () => ({ statusCode: 201 });
    assert.equal((await wp.send(sub, {}, keys)).ok, true);
    webpush.sendNotification = async () => { throw Object.assign(new Error("gone"), { statusCode: 410 }); };
    assert.equal((await wp.send(sub, {}, keys)).gone, true);
  } finally {
    webpush.sendNotification = real;
  }
  assert.equal((await wp.send(sub, {}, null)).reason, "not_configured");
  assert.equal(wp.endpointAllowed("https://updates.push.services.mozilla.com/wpush/v2/x"), true);
  assert.equal(wp.endpointAllowed("https://sub.notify.windows.com/w/?token=x"), true);
  assert.equal(wp.endpointAllowed("https://notify.windows.com.evil/x"), false);
});
