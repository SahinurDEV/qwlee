const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// Pure regex checks mirroring risk.service PAY_OFF / CONTACT (no DB).
const PAY_OFF = [
  ["pay-outside", /\b(pay\s+(me\s+)?outside|outside\s+(the\s+)?platform|off[- ]?platform\s+pay)\b/i],
  ["pay-outside", /\b(venmo|cash\s?app|paypal\.me|wire\s+transfer|gift\s*card)\b/i],
];

describe("fraud pay-outside rules", () => {
  it("flags venmo and pay outside", () => {
    const s = "Please pay me outside on Venmo";
    const hits = [];
    for (const [r, re] of PAY_OFF) if (re.test(s)) hits.push(r);
    assert.ok(hits.includes("pay-outside"));
  });
  it("does not flag normal thanks", () => {
    const s = "Thanks for the delivery!";
    const hits = [];
    for (const [r, re] of PAY_OFF) if (re.test(s)) hits.push(r);
    assert.equal(hits.length, 0);
  });
});
