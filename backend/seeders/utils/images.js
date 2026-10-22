// Seed images are committed to the repo under backend/public/seed/<kind>/
// and served by the API at /seed/... (see src/app.js). Nothing depends on
// a third-party image host being reachable at runtime.
//
// The original photos come from picsum.photos (Unsplash licence). To
// refresh the pool run: node scripts/fetch-seed-images.js
//
// URLs are stored absolute when PUBLIC_API_URL (or SEED_IMAGE_BASE_URL)
// is set, so every <img>/<Image> in the apps renders them directly;
// otherwise they are root-relative and the apps' getImageUrl() helpers
// prefix the API base. Re-run the seed after changing the public URL.

const fs = require("fs");
const path = require("path");

const SEED_DIR = path.join(__dirname, "../../public/seed");
const BASE = (process.env.SEED_IMAGE_BASE_URL || process.env.PUBLIC_API_URL || "").replace(/\/+$/, "");

const pools = {};
const pool = (kind) => {
  if (!pools[kind]) {
    const dir = path.join(SEED_DIR, kind);
    pools[kind] = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort()
      : [];
    if (!pools[kind].length) throw new Error(`No seed images found in ${dir}`);
  }
  return pools[kind];
};

// Small deterministic string hash so the same seed always gets the same image.
const hash = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

const pick = (kind, seed, offset = 0) => {
  const files = pool(kind);
  const file = files[(hash(seed) + offset) % files.length];
  return `${BASE}/seed/${kind}/${file}`;
};

// Seed gigs have purpose-made gallery images (scripts/gen-gig-images.js)
// named <slug(title)>-<n>.jpg; anything else falls back to the pool.
const { slugify } = require("./slug");
const gigImage = (title, n = 0) => {
  const file = `${slugify(title)}-${n}.jpg`;
  if (fs.existsSync(path.join(SEED_DIR, "gig", file))) return `${BASE}/seed/gig/${file}`;
  return pick("gig", title, n);
};

module.exports = {
  avatar: (seed) => pick("avatar", seed),
  cover: (seed) => pick("cover", seed),
  gig: gigImage,
  portfolio: (seed, n = 0) => pick("portfolio", seed, n),
  banner: (seed) => pick("banner", seed),
  blog: (seed) => pick("blog", seed),
  category: (seed) => pick("category", seed),
  pools: () => ["avatar", "cover", "gig", "portfolio", "banner", "blog", "category"].reduce((o, k) => ({ ...o, [k]: pool(k).length }), {}),
};
