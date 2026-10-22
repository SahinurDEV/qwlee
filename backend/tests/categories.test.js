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
  return { status: res.status, json, data: json?.data?.attributes ?? json?.data };
};
const login = async (email, password) => {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  assert.equal(r.status, 200, `login ${email}`);
  return { token: r.data.tokens.access.token, user: r.data.user };
};

test("categories default to top level; subcategories by parent", async () => {
  const top = await call("GET", "/categories?limit=100");
  assert.equal(top.status, 200);
  assert.ok(top.data.results.length >= 10);
  assert.ok(top.data.results.every((c) => !c.parentId), "default list is top-level only");
  const web = top.data.results.find((c) => c.name === "Web Development");
  const subs = await call("GET", `/categories?parentId=${web.id}&limit=100`);
  assert.ok(subs.data.results.length >= 2);
  assert.ok(subs.data.results.every((c) => String(c.parentId) === String(web.id)));
  const all = await call("GET", "/categories?level=all&limit=500");
  assert.ok(all.data.totalResults > top.data.totalResults);
});

test("gig filters: subcategory and delivery time", async () => {
  const top = await call("GET", "/categories?limit=100");
  const web = top.data.results.find((c) => c.name === "Web Development");
  const subs = (await call("GET", `/categories?parentId=${web.id}&limit=100`)).data.results;
  let matched = 0;
  for (const s of subs) {
    const r = await call("GET", `/gig?subCategory=${s.id}&limit=50`);
    assert.equal(r.status, 200);
    for (const g of r.data.results) {
      assert.equal(String(g.subCategoryId?.id || g.subCategoryId), String(s.id));
      matched++;
    }
  }
  assert.ok(matched > 0, "seeded gigs carry subcategories");
  const fast = await call("GET", "/gig?delivery=3&limit=100");
  assert.equal(fast.status, 200);
  for (const g of fast.data.results) assert.ok(g.package.some((p) => Number(p.deliveryDate) <= 3));
  const allGigs = await call("GET", "/gig?limit=1");
  assert.ok(fast.data.totalResults < allGigs.data.totalResults);
});

test("admin subcategory rules: one level, parent must exist, no deleting parents with children", async () => {
  const admin = await login("admin@example.com", "Admin123!");
  const seller = await login("seller@example.com", "Seller123!");
  const top = (await call("GET", "/categories?limit=100")).data.results;
  const web = top.find((c) => c.name === "Web Development");
  const sub = (await call("GET", `/categories?parentId=${web.id}`)).data.results[0];

  assert.equal((await call("POST", "/categories", { token: seller.token, body: { name: "x" } })).status, 403);
  const nested = await call("POST", "/categories", { token: admin.token, body: { name: "Too deep", parentId: sub.id } });
  assert.equal(nested.status, 400);
  const blocked = await call("DELETE", `/categories/${web.id}`, { token: admin.token });
  assert.equal(blocked.status, 400);

  const created = await call("POST", "/categories", { token: admin.token, body: { name: `Test sub ${Date.now()}`, parentId: web.id } });
  assert.equal(created.status, 201);
  const id = created.json.data.id || created.json.data.attributes?.id;
  assert.equal((await call("DELETE", `/categories/${id}`, { token: admin.token })).status, 200);
});

test("gig subcategory must belong to its category", async () => {
  const seller = await login("seller@example.com", "Seller123!");
  const top = (await call("GET", "/categories?limit=100")).data.results;
  const gig = (await call("GET", `/gig?limit=200`)).data.results.find(
    (g) => String(g.userId?.id || g.userId?._id || g.userId) === String(seller.user.id)
  );
  assert.ok(gig, "seller has a public gig");
  const gigId = gig.id || gig._id;
  const catId = gig.categoriesId?.id || gig.categoriesId;
  const other = top.find((c) => c.id !== catId);
  const foreignSub = (await call("GET", `/categories?parentId=${other.id}`)).data.results[0];
  const bad = await call("PATCH", `/gig/${gigId}`, { token: seller.token, body: { subCategoryId: foreignSub.id } });
  assert.equal(bad.status, 400);
  const ownSub = (await call("GET", `/categories?parentId=${catId}`)).data.results[0];
  const ok = await call("PATCH", `/gig/${gigId}`, { token: seller.token, body: { subCategoryId: ownSub.id } });
  assert.equal(ok.status, 200);
});
