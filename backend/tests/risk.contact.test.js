const { test } = require("node:test");
const assert = require("node:assert/strict");
const { detectContact, deobfuscate } = require("../src/services/risk.service");

test("detects plain email and phone", () => {
  const r = detectContact("Email me at buyer@gmail.com or +8801712345678");
  assert.ok(r.includes("contact:email"));
  assert.ok(r.includes("contact:phone"));
});

test("detects obfuscated email", () => {
  const r = detectContact("reach me john at gmail dot com please");
  assert.ok(r.some((x) => x.includes("email") || x.includes("obfuscated")), String(r));
});

test("detects digit-word phone", () => {
  const r = detectContact("call zero one seven one two three four five six seven eight");
  assert.ok(r.some((x) => x.includes("phone") || x.includes("obfuscated")), String(r));
});

test("detects whatsapp / off-platform ask", () => {
  const r = detectContact("lets talk on whatsapp outside the platform");
  assert.ok(r.includes("contact:messenger"));
  assert.ok(r.includes("contact:offplatform"));
});

test("deobfuscate rewrites long digit-word runs without mangling recommendation", () => {
  const s = deobfuscate("zero one seven one two three four five six seven");
  assert.match(s, /0171234567/);
  const clean = deobfuscate("I will come back with a package recommendation today.");
  assert.ok(!clean.includes("@"), clean);
});

test("benign Figma message is not flagged as social", () => {
  const r = detectContact("Doable. Can you share the Figma? I will come back with a package recommendation today.");
  assert.deepEqual(r, []);
});
