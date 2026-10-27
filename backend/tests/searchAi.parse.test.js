const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { matchReasons } = require("../src/services/searchAi/parse");

describe("searchAi matchReasons", () => {
  it("mentions price and keywords", () => {
    const r = matchReasons(
      { title: "I will design a bakery logo", price: 40, searchTags: ["logo"] },
      { keywords: "logo bakery", maxPrice: 50, categoryHint: "Graphic Design" }
    );
    assert.ok(r.some((x) => /logo/i.test(x)));
    assert.ok(r.some((x) => /50/.test(x)));
  });
});
