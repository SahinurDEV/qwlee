// Two-factor sign-in for regular (non-admin) accounts.
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
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data?.attributes ?? json?.data };
};
const creds = { email: "seller@example.com", password: "Seller123!" };
const now = (secret, d = 0) => totp.codeAt(secret, Math.floor(Date.now() / 30000) + d);

test("two-factor for a seller: setup, login needs code, replay refused, recovery code, disable", async () => {
  const first = await call("POST", "/auth/login", { body: creds });
  assert.equal(first.status, 200);
  const token = first.data.tokens.access.token;
  assert.equal((await call("GET", "/two-factor", { token })).data.enabled, false);
  assert.equal((await call("GET", "/two-factor")).status, 401);

  const setup = await call("POST", "/two-factor/setup", { token });
  assert.equal(setup.status, 200);
  assert.match(setup.data.otpauthUrl, /^otpauth:\/\/totp\//);
  const secret = setup.data.secret;
  assert.equal((await call("POST", "/two-factor/enable", { token, body: { code: "000000" } })).status, 400);
  const en = await call("POST", "/two-factor/enable", { token, body: { code: now(secret) } });
  assert.equal(en.status, 200, JSON.stringify(en.json));
  const recovery = en.data.recoveryCodes;
  assert.equal(recovery.length, 8);
  assert.equal(en.json.data.attributes.secret, undefined);
  try {
    const noCode = await call("POST", "/auth/login", { body: creds });
    assert.equal(noCode.status, 401);
    assert.equal(noCode.data.twoFactorRequired, true);
    assert.equal(noCode.data.tokens, undefined);
    // The step used for enabling is spent; the next step works once.
    const ok = await call("POST", "/auth/login", { body: { ...creds, otp: now(secret, 1) } });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.ok(ok.data.tokens.access.token);
    assert.equal((await call("POST", "/auth/login", { body: { ...creds, otp: now(secret, 1) } })).status, 401, "replay refused");
    const rec = await call("POST", "/auth/login", { body: { ...creds, otp: recovery[0] } });
    assert.equal(rec.status, 200);
    assert.equal((await call("POST", "/auth/login", { body: { ...creds, otp: recovery[0] } })).status, 401, "recovery code is single use");
    assert.equal((await call("GET", "/two-factor", { token })).data.recoveryLeft, 7);
    // A forged/garbage Google challenge is refused.
    assert.equal((await call("POST", "/auth/2fa/verify", { body: { challenge: "x", code: "123456" } })).status, 401);
    assert.equal((await call("POST", "/two-factor/disable", { token, body: { code: "999999" } })).status, 400);
  } finally {
    const off = await call("POST", "/two-factor/disable", { token, body: { code: recovery[1] } });
    assert.equal(off.status, 200);
  }
  assert.equal((await call("POST", "/auth/login", { body: creds })).status, 200, "password-only again");
});
