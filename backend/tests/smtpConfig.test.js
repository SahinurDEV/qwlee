const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");

describe("smtpConfig readiness", () => {
  const saved = { ...process.env };
  after(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in saved)) delete process.env[k];
    }
    Object.assign(process.env, saved);
    delete require.cache[require.resolve("../src/services/smtpConfig.service")];
  });

  it("flags mailpit as local-catcher", () => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1025";
    delete process.env.SMTP_USERNAME;
    delete process.env.EMAIL_FROM;
    delete require.cache[require.resolve("../src/services/smtpConfig.service")];
    const r = require("../src/services/smtpConfig.service").readiness();
    assert.equal(r.mode, "local-catcher");
    assert.equal(r.readyForLiveMail, false);
  });

  it("is configured for a real host with from", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    process.env.EMAIL_FROM = "noreply@example.com";
    delete require.cache[require.resolve("../src/services/smtpConfig.service")];
    const r = require("../src/services/smtpConfig.service").readiness();
    assert.equal(r.mode, "configured");
    assert.equal(r.readyForLiveMail, true);
    assert.equal(r.authConfigured, true);
  });
});
