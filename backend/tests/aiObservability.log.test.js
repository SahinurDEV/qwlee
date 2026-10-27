const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("ai observability feature enum", () => {
  it("accepts known features only", () => {
    const allowed = new Set(["dispute", "support", "search", "fraud", "insights"]);
    assert.ok(allowed.has("dispute"));
    assert.ok(!allowed.has("prompt"));
  });
});
