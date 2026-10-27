// Must set before emptyDbGuard → logger → config loads.
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-16chars";
process.env.MONGODB_URL = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/qwlee_test";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("emptyDbGuard production refuse", () => {
  it("enabled() reads SEED_DEMO_IF_EMPTY", () => {
    process.env.SEED_DEMO_IF_EMPTY = "true";
    delete require.cache[require.resolve("../src/services/emptyDbGuard")];
    assert.equal(require("../src/services/emptyDbGuard").enabled(), true);
  });
});
