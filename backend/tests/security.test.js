const { test } = require("node:test");
const assert = require("node:assert/strict");
const totp = require("../src/utils/totp");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, data: json?.data?.attributes ?? json?.data };
};
const login = async (email, password, otp) => {
  const r = await call("POST", "/auth/login", { body: { email, password, ...(otp ? { otp } : {}) } });
  return { r, token: r.data?.tokens?.access?.token, user: r.data?.user };
};
const nextStepCode = async (secret) => {
  // Wait for a fresh 30 s window so the code isn't a replay of the last one.
  const wait = 30000 - (Date.now() % 30000) + 200;
  await new Promise((r) => setTimeout(r, wait));
  return totp.codeAt(secret, Math.floor(Date.now() / 30000));
};

test("TOTP matches the RFC 6238 test vector", () => {
  assert.equal(totp.codeAt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1), "287082");
});

test("admin two-factor: setup, login needs code, no replay, recovery code, disable", { timeout: 120000 }, async () => {
  const mod = await login("moderator@example.com", "Admin123!");
  assert.equal(mod.r.status, 200);
  const setup = await call("POST", "/admin/2fa/setup", { token: mod.token });
  assert.equal(setup.status, 200);
  const secret = setup.data.secret;
  assert.match(setup.data.otpauthUrl, /^otpauth:\/\/totp\//);
  assert.equal((await call("POST", "/admin/2fa/enable", { token: mod.token, body: { code: "000000" } })).status, 400);
  const en = await call("POST", "/admin/2fa/enable", { token: mod.token, body: { code: totp.codeAt(secret, Math.floor(Date.now() / 30000)) } });
  assert.equal(en.status, 200, JSON.stringify(en.json));
  const recovery = en.data.recoveryCodes;
  assert.equal(recovery.length, 8);
  try {
    const noCode = await login("moderator@example.com", "Admin123!");
    assert.equal(noCode.r.status, 401);
    assert.equal(noCode.r.data.twoFactorRequired, true);
    assert.equal((await login("moderator@example.com", "Admin123!", "123456")).r.status, 401);
    const code = await nextStepCode(secret);
    const ok = await login("moderator@example.com", "Admin123!", code);
    assert.equal(ok.r.status, 200);
    assert.equal(ok.r.data.user.twoFactorSecret, undefined, "secret never leaves the server");
    assert.equal((await login("moderator@example.com", "Admin123!", code)).r.status, 401, "a code works once");
    const viaRecovery = await login("moderator@example.com", "Admin123!", recovery[0]);
    assert.equal(viaRecovery.r.status, 200);
    assert.equal((await login("moderator@example.com", "Admin123!", recovery[0])).r.status, 401, "recovery codes are single-use");
    const off = await call("POST", "/admin/2fa/disable", { token: ok.token, body: { code: recovery[1] } });
    assert.equal(off.status, 200, JSON.stringify(off.json));
  } finally {
    // Make sure the seed account is left without 2FA even if a step failed.
    const sup = await login("admin@example.com", "Admin123!");
    await call("POST", `/admin/team/${mod.user.id}/reset-2fa`, { token: sup.token });
  }
  assert.equal((await login("moderator@example.com", "Admin123!")).r.status, 200);
});

test("security settings refuse to lock the current admin out", async () => {
  const sup = await login("admin@example.com", "Admin123!");
  const r = await call("PATCH", "/admin/settings/site", { token: sup.token, body: { security: { adminIpAllowlist: ["203.0.113.1"] } } });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /current address/);
  const r2 = await call("PATCH", "/admin/settings/site", { token: sup.token, body: { security: { requireAdmin2fa: true } } });
  assert.equal(r2.status, 400, "can't require 2FA before having it");
});

test("audit log exports CSV; repeated denials alert super admins", async () => {
  const sup = await login("admin@example.com", "Admin123!");
  const csv = await call("GET", "/admin/audit?format=csv&limit=5", { token: sup.token });
  assert.equal(csv.status, 200);
  assert.match(csv.text, /^time,admin,role,action/);
  const fin = await login("finance@example.com", "Admin123!");
  for (let i = 0; i < 5; i++) await call("PATCH", "/admin/settings/site", { token: fin.token, body: {} });
  await new Promise((r) => setTimeout(r, 800));
  let all = "";
  for (let page = 1; page <= 5; page++) {
    const notes = await call("GET", `/notification/admin?limit=50&page=${page}`, { token: sup.token });
    all += JSON.stringify(notes.json);
    if (/finance@example\.com was refused 5 admin actions/.test(all)) break;
  }
  assert.match(all, /finance@example\.com was refused 5 admin actions/);
});

test("bad requests answer 4xx, not 500: empty login body, disallowed origin", async () => {
  const base = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
  for (const init of [{}, { headers: { "content-type": "application/json" }, body: "{}" }, { headers: { "content-type": "text/plain" }, body: "x" }]) {
    const r = await fetch(`${base}/v1/auth/login`, { method: "POST", ...init });
    assert.equal(r.status, 400, `login ${JSON.stringify(init)}`);
  }
  const r = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { origin: "http://not-allowed.example", "content-type": "application/json" },
    body: JSON.stringify({ email: "a@b.c", password: "x" }),
  });
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("access-control-allow-origin"), null);
});
