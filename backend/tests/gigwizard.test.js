const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
// Seeded/uploaded images may carry the public (tunnel) host. Fetch them
// from the API under test instead so the check works offline.
const localUrl = (u) => {
  const url = new URL(u, API + "/");
  const m = url.pathname.match(/\/(seed|uploads)\/.*/);
  return m ? `${API}${m[0]}` : url.href;
};
const json = async (res) => {
  const j = await res.json().catch(() => null);
  return { status: res.status, json: j, data: j?.data?.attributes ?? j?.data };
};
const call = async (method, path, { token, body } = {}) =>
  json(await fetch(`${API}/v1${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }));
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200);
  return { token: r.data.tokens.access.token, user: r.data.user };
};
// Smallest valid PNG (1x1).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const PKGS = [
  { name: "Basic", price: 50, deliveryDate: 3, features: ["One page"] },
  { name: "Standard", price: 120, deliveryDate: 5, features: ["Three pages"] },
];
const createGig = async (token, { pkgs = PKGS, files = [PNG, PNG], title = "I will build a tested landing page for you" } = {}) => {
  const cats = await call("GET", "/categories?limit=50");
  const fd = new FormData();
  fd.append("title", title);
  fd.append("description", "<p>A detailed description of what I deliver.</p>");
  fd.append("categoriesId", cats.data.results[0].id);
  fd.append("package", JSON.stringify(pkgs));
  files.forEach((b, i) => fd.append("images", new Blob([b], { type: "image/png" }), `img${i}.png`));
  return json(await fetch(`${API}/v1/gig`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: fd }));
};

test("gig create validates packages and title", async () => {
  const s = await login("seller@example.com", "Seller123!");
  assert.equal((await createGig(s.token, { pkgs: [] })).status, 400);
  assert.equal((await createGig(s.token, { pkgs: [{ name: "Basic", price: 2, deliveryDate: 3 }] })).status, 400);
  assert.equal((await createGig(s.token, { pkgs: [{ name: "Basic", price: 20, deliveryDate: 400 }] })).status, 400);
  assert.equal((await createGig(s.token, { title: "too short" })).status, 400);
});

test("gig create uploads images, reorders them and price follows packages", async () => {
  const s = await login("seller@example.com", "Seller123!");
  const r = await createGig(s.token);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const gig = r.data;
  gig.id = String(gig.id || gig._id);
  try {
    assert.equal(gig.images.length, 2);
    assert.equal(gig.price, 50);
    assert.match(gig.slug, /^i-will-build-a-tested-landing-page-for-you-/);
    // Images are reachable (local /uploads fallback or the ImgBB CDN).
    const img = await fetch(localUrl(gig.images[0]));
    assert.equal(img.status, 200);
    if (gig.images[0].includes("/uploads/")) assert.equal(img.headers.get("cross-origin-resource-policy"), "cross-origin");

    const rev = [...gig.images].reverse();
    const ok = await call("PATCH", `/gig/${gig.id}`, { token: s.token, body: { images: rev, package: [{ name: "Basic", price: 75, deliveryDate: 2 }] } });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.deepEqual(ok.data.images, rev);
    assert.equal(ok.data.price, 75);
    const foreign = await call("PATCH", `/gig/${gig.id}`, { token: s.token, body: { images: ["https://evil.example/x.png"] } });
    assert.equal(foreign.status, 400);
    const empty = await call("PATCH", `/gig/${gig.id}`, { token: s.token, body: { images: [] } });
    assert.equal(empty.status, 400);
  } finally {
    await call("DELETE", `/gig/${gig.id}`, { token: s.token });
  }
});

test("non-image upload is rejected", async () => {
  const s = await login("seller@example.com", "Seller123!");
  const r = await createGig(s.token, { files: [Buffer.from("<script>alert(1)</script>")] });
  assert.equal(r.status, 400);
});
