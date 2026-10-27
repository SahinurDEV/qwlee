const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "../data/legal");
const privacy = fs.readFileSync(path.join(dir, "privacy.html"), "utf8");
const terms = fs.readFileSync(path.join(dir, "terms.html"), "utf8");

test("privacy policy covers GDPR-style topics and OpenRouter", () => {
  assert.match(privacy, /OpenRouter/i);
  assert.match(privacy, /legal bas/i);
  assert.match(privacy, /Cookie/i);
  assert.match(privacy, /18 or older/i);
  assert.match(privacy, /International transfers/i);
  assert.match(privacy, /Download a copy/i);
  assert.match(privacy, /California/i);
  assert.doesNotMatch(privacy, /seed content/i);
  assert.match(privacy, /27 October 2026/);
});

test("terms fix fee drift and point at payment-terms", () => {
  assert.match(terms, /5%/);
  assert.match(terms, /5\.5%/);
  assert.doesNotMatch(terms, /10% service fee/);
  assert.match(terms, /payment-terms/);
  assert.doesNotMatch(terms, /seed content/i);
  assert.match(terms, /OpenRouter|AI features/i);
});
