// Marketplace search: service-rating / review-count / video filters and
// "Best rated" / "Best selling" sorting (cached gig stats).
const { test } = require("node:test");
const assert = require("node:assert/strict");

const API = (process.env.API_URL || "http://localhost:7171").replace(/\/+$/, "");
const gigs = async (qs) => {
  const r = await fetch(`${API}/v1/gig?limit=100&${qs}`).then((x) => x.json());
  return r.data.attributes.results;
};

test("gig stats are public and filters narrow results", async () => {
  const all = await gigs("");
  assert.ok(all.length > 0);
  assert.ok(all.every((g) => typeof g.rating?.avg === "number" && typeof g.ordersCompleted === "number"), "rating/ordersCompleted on every gig");
  const reviewed = await gigs("minReviews=1");
  assert.ok(reviewed.length > 0, "seed has a reviewed active gig");
  assert.ok(reviewed.length <= all.length);
  assert.ok(reviewed.every((g) => g.rating.count >= 1));
  const top = await gigs("minGigRating=4.5");
  assert.ok(top.every((g) => g.rating.avg >= 4.5));
  assert.equal((await gigs("minGigRating=99")).every((g) => g.rating.avg >= 5), true, "clamped to 5");
  assert.equal((await gigs("minGigRating=abc")).length, all.length, "garbage ignored");
  assert.ok((await gigs("hasVideo=true")).every((g) => g.video));
});

test("sort: best rated and best selling", async () => {
  const rated = await gigs("sortBy=rating.avg:desc,rating.count:desc");
  for (let i = 1; i < rated.length; i++) assert.ok(rated[i - 1].rating.avg >= rated[i].rating.avg);
  const selling = await gigs("sortBy=ordersCompleted:desc");
  for (let i = 1; i < selling.length; i++) assert.ok(selling[i - 1].ordersCompleted >= selling[i].ordersCompleted);
});
