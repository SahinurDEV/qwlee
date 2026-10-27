const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { CONF_THRESHOLD, RATE_MAX, assertRate } = require("../src/services/supportAi/ask");
const { maskContact } = require("../src/services/risk.service");

describe("supportAi helpers", () => {
  it("confidence threshold is 0.55", () => {
    assert.equal(CONF_THRESHOLD, 0.55);
  });

  it("rate limit trips after RATE_MAX", () => {
    const uid = "rate-test-user-" + Date.now();
    for (let i = 0; i < RATE_MAX; i++) assertRate(uid);
    assert.throws(() => assertRate(uid), /rate limit/i);
  });

  it("maskContact redacts email before the AI sees it", () => {
    const out = maskContact("Refund to me at buyer@example.com please");
    assert.equal(out.toLowerCase().includes("buyer@example.com"), false);
  });
});
