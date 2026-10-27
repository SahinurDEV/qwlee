const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const authCookies = require("../src/utils/authCookies");

describe("authCookies", () => {
  it("parses accessToken from Cookie header (quoted or plain)", () => {
    assert.equal(
      authCookies.parseCookieHeader('foo=1; accessToken="abc.def.ghi"; bar=2', "accessToken"),
      "abc.def.ghi"
    );
    assert.equal(
      authCookies.parseCookieHeader("accessToken=plain.token.value", "accessToken"),
      "plain.token.value"
    );
  });

  it("setAuthCookies marks httpOnly", () => {
    const jar = [];
    const res = {
      cookie(name, value, opts) {
        jar.push({ name, value, opts });
      },
    };
    authCookies.setAuthCookies({ headers: {}, secure: false }, res, {
      access: { token: "a.b.c", expires: new Date(Date.now() + 60000).toISOString() },
      refresh: { token: "r.e.f", expires: new Date(Date.now() + 60000).toISOString() },
    });
    assert.equal(jar.length, 2);
    assert.equal(jar[0].opts.httpOnly, true);
    assert.equal(jar[0].opts.path, "/");
    assert.ok(["lax", "none", "strict"].includes(String(jar[0].opts.sameSite).toLowerCase()));
  });
});
