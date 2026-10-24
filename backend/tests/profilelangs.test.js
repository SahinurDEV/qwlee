const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}/v1${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data?.attributes ?? json?.data };
};

test("seller languages with levels and certifications", async () => {
  const login = await call("POST", "/auth/login", { body: { email: "thiago.ribeiro@example.com", password: "Seller123!" } });
  const token = login.data.tokens.access.token;
  const username = login.data.user.username;
  const before = login.data.user.language;

  assert.equal((await call("POST", "/users/profile", { token, body: { certifications: [{ title: "" }] } })).status, 400);
  assert.equal((await call("POST", "/users/profile", { token, body: { certifications: [{ title: "X", url: "javascript:alert(1)" }] } })).status, 400);
  assert.equal((await call("POST", "/users/profile", { token, body: { certifications: [{ title: "X", year: 1800 }] } })).status, 400);
  assert.equal((await call("POST", "/users/profile", { token, body: { languages: [{ name: "English, Spanish" }] } })).status, 400);

  const ok = await call("POST", "/users/profile", {
    token,
    body: {
      languages: [{ name: "Portuguese", level: "native" }, { name: "English", level: "fluent" }, { name: "english", level: "basic" }, { name: "Esperanto", level: "wizard" }],
      certifications: [{ title: "Google UX Design", issuer: "Coursera", year: 2023, url: "https://coursera.org/verify/abc" }],
    },
  });
  assert.equal(ok.status, 200);
  try {
    const pub = await call("GET", `/users/by-username/${username}`);
    const u = pub.data?.user || pub.data;
    assert.deepEqual(u.languages.map((l) => l.name), ["Portuguese", "English", "Esperanto"]);
    assert.equal(u.languages[2].level, "conversational", "unknown level falls back");
    assert.equal(u.language, "Portuguese, English, Esperanto", "legacy string kept in sync");
    assert.equal(u.certifications[0].title, "Google UX Design");
  } finally {
    await call("POST", "/users/profile", { token, body: { languages: String(before || "English").split(",").map((n) => ({ name: n.trim(), level: "fluent" })), certifications: [] } });
  }
});
