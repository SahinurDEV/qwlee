const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

describe("paymentsConfig readiness", () => {
  const saved = { ...process.env };
  after(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in saved)) delete process.env[k];
    }
    Object.assign(process.env, saved);
    // Clear module cache so later tests see real env.
    delete require.cache[require.resolve("../src/services/paymentsConfig.service")];
  });

  it("reports demo when only DEMO_PAYMENTS is set", () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    process.env.DEMO_PAYMENTS = "true";
    delete require.cache[require.resolve("../src/services/paymentsConfig.service")];
    const r = require("../src/services/paymentsConfig.service").readiness();
    assert.equal(r.mode, "demo");
    assert.equal(r.readyForLiveCharges, false);
  });

  it("prefers stripe when secret key is present", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    process.env.STRIPE_PUBLISHABLE_KEY = "pk_test_x";
    process.env.DEMO_PAYMENTS = "true";
    delete require.cache[require.resolve("../src/services/paymentsConfig.service")];
    const r = require("../src/services/paymentsConfig.service").readiness();
    assert.equal(r.mode, "stripe");
    assert.equal(r.readyForLiveCharges, true);
    assert.equal(r.demoPayments, true);
  });

  it("is unconfigured when neither stripe nor demo", () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.DEMO_PAYMENTS = "false";
    delete require.cache[require.resolve("../src/services/paymentsConfig.service")];
    const r = require("../src/services/paymentsConfig.service").readiness();
    assert.equal(r.mode, "unconfigured");
    assert.equal(r.readyForLiveCharges, false);
  });
});
