const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");

describe("emptyDbGuard production refuse", () => {
  const saved = { ...process.env };
  after(() => {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    delete require.cache[require.resolve("../src/services/emptyDbGuard")];
  });

  it("enabled() still reads the flag", () => {
    process.env.SEED_DEMO_IF_EMPTY = "true";
    delete require.cache[require.resolve("../src/services/emptyDbGuard")];
    assert.equal(require("../src/services/emptyDbGuard").enabled(), true);
  });
});
