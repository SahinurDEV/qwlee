// Refreshes backend/public/seed/* from picsum.photos (Unsplash licence).
// Usage: node scripts/fetch-seed-images.js   (needs network, Node 18+)
const fs = require("fs");
const path = require("path");

const KINDS = {
  avatar: [300, 300, 15, 1000],
  cover: [1200, 300, 7, 10],
  // gig images are generated per gig: node scripts/gen-gig-images.js
  portfolio: [800, 600, 15, 60],
  banner: [1600, 500, 5, 100],
  blog: [900, 500, 11, 110],
  category: [400, 400, 15, 130],
};

(async () => {
  for (const [kind, [w, h, n, startId]] of Object.entries(KINDS)) {
    const dir = path.join(__dirname, "../public/seed", kind);
    fs.mkdirSync(dir, { recursive: true });
    let saved = 0;
    for (let id = startId; saved < n && id < startId + n * 3; id++) {
      const res = await fetch(`https://picsum.photos/id/${id}/${w}/${h}.jpg`);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf[0] !== 0xff || buf[1] !== 0xd8) continue;
      saved++;
      fs.writeFileSync(path.join(dir, `${String(saved).padStart(2, "0")}.jpg`), buf);
    }
    console.log(`${kind}: ${saved}`);
  }
})();
