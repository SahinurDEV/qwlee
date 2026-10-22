const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const login = async (email, password) => {
  const r = await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j));
  return (j.data?.attributes ?? j.data).tokens.access.token;
};
// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("ID documents are private and only reachable through signed, expiring links", async () => {
  const buyer = await login("buyer@example.com", "Buyer123!");
  const fd = new FormData();
  fd.append("documentType", "passport");
  fd.append("front", new Blob([PNG], { type: "image/png" }), "front.png");
  fd.append("selfie", new Blob([PNG], { type: "image/png" }), "selfie.png");
  const sub = await fetch(`${API}/v1/verification/submit`, { method: "POST", headers: { authorization: `Bearer ${buyer}` }, body: fd });
  const sj = await sub.json();
  assert.ok(sub.status < 300, JSON.stringify(sj));
  assert.doesNotMatch(JSON.stringify(sj), /ibb\.co|\/uploads\//, "no public URL for ID docs");

  const admin = await login("admin@example.com", "Admin123!");
  const list = await (await fetch(`${API}/v1/verification?status=pending`, { headers: { authorization: `Bearer ${admin}` } })).json();
  const me = (list.data?.attributes ?? list.data).results.find((u) => u.email === "buyer@example.com");
  const url = me.verification.frontUrl;
  assert.match(url, /\/v1\/files\/private\/[a-f0-9]{32}\.png\?exp=\d+&sig=[a-f0-9]{64}$/);
  const local = url.replace(/^.*?(?=\/v1\/files\/)/, API);
  const ok = await fetch(local);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "private, no-store");
  assert.equal((await fetch(local.replace(/sig=[a-f0-9]{4}/, "sig=0000"))).status, 403, "tampered link refused");
  assert.equal((await fetch(local.replace(/exp=\d+/, "exp=1"))).status, 403, "expired link refused");
  const name = url.match(/private\/([^?]+)/)[1];
  assert.notEqual((await fetch(`${API}/uploads/.private/${name}`)).status, 200, "not reachable via public /uploads");
  assert.notEqual((await fetch(`${API}/uploads/${name}`)).status, 200);
});

test("orphaned uploads: scan is admin-only", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  assert.equal((await fetch(`${API}/v1/admin/settings/storage/orphans`, { headers: { authorization: `Bearer ${seller}` } })).status, 403);
  const admin = await login("admin@example.com", "Admin123!");
  const r = await fetch(`${API}/v1/admin/settings/storage/orphans`, { headers: { authorization: `Bearer ${admin}` } });
  const j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j));
  const d = j.data?.attributes ?? j.data;
  assert.equal(d.applied, false);
  assert.equal(typeof d.orphans, "number");
});
