const { test, before } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, data: json?.data?.attributes ?? json?.data };
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, `login ${email}`);
  return { token: r.data.tokens.access.token, user: r.data.user };
};
const S = () => login("admin@example.com", "Admin123!");

test("homepage layout: order, hide, custom blocks, validation", async () => {
  const sup = await S();
  const orig = (await call("GET", "/admin/settings/site", { token: sup.token })).data.site;
  try {
    const def = (await call("GET", "/info/site")).data.homepage;
    assert.deepEqual(def.sections.map((x) => x.key).slice(0, 2), ["stats", "recentlyViewed"]);
    const bad = await call("PATCH", "/admin/settings/site", { token: sup.token, body: { homepage: { blocks: [{ id: "block-1", title: "x", ctaLink: "//evil.example" }] } } });
    assert.equal(bad.status, 400);
    const r = await call("PATCH", "/admin/settings/site", {
      token: sup.token,
      body: { homepage: {
        sections: [{ key: "block-1", enabled: true }, { key: "blog", enabled: true }, { key: "stats", enabled: false }, { key: "bogus" }, { key: "blog" }],
        blocks: [{ id: "block-1", title: "Spring sale", text: "20% off", ctaLabel: "Browse", ctaLink: "/gig", tone: "brand", evil: 1 }, { id: "block-9", title: "no" }],
      } },
    });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const h = (await call("GET", "/info/site")).data.homepage;
    assert.deepEqual(h.sections.slice(0, 3), [{ key: "block-1", enabled: true }, { key: "blog", enabled: true }, { key: "stats", enabled: false }]);
    assert.equal(h.sections.length, 11, "unknown/duplicate dropped, missing defaults appended");
    assert.deepEqual(h.blocks, [{ id: "block-1", title: "Spring sale", text: "20% off", ctaLabel: "Browse", ctaLink: "/gig", tone: "brand" }]);
  } finally {
    await call("PATCH", "/admin/settings/site", { token: sup.token, body: orig });
  }
});
