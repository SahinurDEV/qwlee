// Renders the seed gig gallery images (3 per seed gig) so every thumbnail
// matches its gig: a cover with the gig's promise, a "what you get" card
// and a package comparison. Output: public/seed/gig/<slug>-<n>.jpg
//
// Dev-only tool. Needs playwright-core and a local Chrome:
//   npm i --no-save playwright-core
//   CHROME=/usr/bin/google-chrome node scripts/gen-gig-images.js
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const { GIGS } = require("../seeders/gigsSeeder");
const { slugify } = require("../seeders/utils/slug");

const OUT = path.join(__dirname, "../public/seed/gig");
const FONT_DIR = process.env.FONT_DIR || path.join(__dirname, "../../frontend/node_modules/@fontsource-variable");

const THEMES = {
  "Web Development": ["#0f766e", "#14b8a6", "</>", "browser"],
  "Mobile Development": ["#1d4ed8", "#60a5fa", "📱", "phone"],
  "UI/UX Design": ["#7c3aed", "#c084fc", "◆", "browser"],
  "Graphic Design": ["#db2777", "#f9a8d4", "✦", "canvas"],
  "Video Editing": ["#b91c1c", "#f87171", "▶", "video"],
  "Digital Marketing": ["#c2410c", "#fdba74", "↗", "chart"],
  "Writing & Translation": ["#334155", "#94a3b8", "¶", "doc"],
  "AI Services": ["#4338ca", "#a5b4fc", "✳", "chat"],
  "Music & Audio": ["#065f46", "#6ee7b7", "♪", "wave"],
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function mock(kind, c2) {
  const bars = [60, 85, 45, 95, 70, 110, 80].map((h) => `<i style="height:${h}px"></i>`).join("");
  const lines = '<b style="width:80%"></b><b style="width:95%"></b><b style="width:70%"></b><b style="width:88%"></b><b style="width:60%"></b>';
  switch (kind) {
    case "phone": return `<div class="phone"><div class="scr"><div class="hdr"></div>${lines}<div class="btn"></div></div></div>`;
    case "video": return `<div class="win"><div class="vid"><span>▶</span></div><div class="tl">${"<s></s>".repeat(8)}</div></div>`;
    case "chart": return `<div class="win pad"><div class="bars">${bars}</div><div class="kpi">+148%</div></div>`;
    case "doc": return `<div class="win pad doc">${lines}${lines}</div>`;
    case "chat": return `<div class="win pad chat"><p class="u">How do I reset my plan?</p><p class="a">Go to Billing → Plan, choose Reset. I've sent the steps to your inbox.</p><p class="u">Thanks!</p></div>`;
    case "wave": return `<div class="win pad wave">${Array.from({ length: 36 }, (_, i) => `<i style="height:${20 + Math.round(Math.abs(Math.sin(i * 0.7)) * 120)}px"></i>`).join("")}</div>`;
    case "canvas": return `<div class="win pad canv"><div class="logo">A</div><div class="sw">${["#db2777", "#f9a8d4", "#111827", "#fde68a"].map((x) => `<i style="background:${x}"></i>`).join("")}</div></div>`;
    default: return `<div class="win"><div class="bar"><u></u><u></u><u></u></div><div class="pad">${lines}<div class="grid"><div></div><div></div><div></div></div></div></div>`;
  }
}

function page(g, n) {
  const [c1, c2, icon, kind] = THEMES[g.category] || ["#0f766e", "#5eead4", "★", "browser"];
  const promise = cap(g.title.replace(/^I will /i, ""));
  const prem = g.packages[g.packages.length - 1];
  let body;
  if (n === 0) {
    body = `<div class="l"><div class="tag">${icon} ${esc(g.category)}</div><h1>${esc(promise)}</h1><div class="by">@${esc(g.seller)} · from $${g.packages[0].price}</div></div><div class="r">${mock(kind, c2)}</div>`;
  } else if (n === 1) {
    body = `<div class="l"><div class="tag">What you get</div><h2>${esc(promise)}</h2></div><div class="r"><ul>${prem.features.map((f) => `<li><span>✓</span>${esc(f)}</li>`).join("")}</ul></div>`;
  } else {
    body = `<div class="full"><div class="tag">Packages</div><div class="pk">${g.packages.map((p) => `<div class="card"><h3>${esc(p.name)}</h3><div class="pr">$${p.price}</div><div class="dd">${p.deliveryDate}-day delivery</div><ol>${p.features.slice(0, 3).map((f) => `<li>${esc(f)}</li>`).join("")}</ol></div>`).join("")}</div></div>`;
  }
  return `<!doctype html><html><head><style>
@font-face{font-family:J;src:url(file://${FONT_DIR}/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2);font-weight:200 800}
@font-face{font-family:I;src:url(file://${FONT_DIR}/inter/files/inter-latin-wght-normal.woff2);font-weight:100 900}
*{box-sizing:border-box;margin:0}body{width:1280px;height:768px;font-family:I,sans-serif;color:#fff;overflow:hidden;
background:radial-gradient(circle at 85% 15%,${c2}55,transparent 45%),linear-gradient(135deg,${c1},#0b1220);display:flex;align-items:center;padding:72px;gap:56px}
.l{flex:1.1}.r{flex:1;display:flex;justify-content:center}.full{width:100%}
.tag{display:inline-block;padding:10px 20px;border-radius:999px;background:#ffffff1f;border:1px solid #ffffff33;font-weight:600;font-size:22px;margin-bottom:28px}
h1{font-family:J;font-weight:800;font-size:56px;line-height:1.08;letter-spacing:-1px}h2{font-family:J;font-weight:700;font-size:44px;line-height:1.12}
.by{margin-top:28px;font-size:24px;opacity:.8}
ul{list-style:none;padding:0;display:flex;flex-direction:column;gap:18px;width:100%}li{font-size:27px;display:flex;gap:16px;align-items:flex-start;background:#ffffff14;padding:18px 22px;border-radius:16px}
li span{color:${c2};font-weight:800}
.pk{display:flex;gap:28px;margin-top:8px}.card{flex:1;background:#fff;color:#0f172a;border-radius:24px;padding:34px}.card h3{font-family:J;font-size:30px;color:${c1}}
.pr{font-family:J;font-weight:800;font-size:60px;margin:10px 0}.dd{color:#475569;font-size:21px;margin-bottom:16px}ol{padding-left:22px;font-size:20px;color:#334155;line-height:1.6}
.win{width:500px;height:380px;background:#fff;border-radius:22px;box-shadow:0 40px 80px #0006;overflow:hidden;color:#0f172a}.pad{padding:28px}
.bar{height:40px;background:#e2e8f0;display:flex;gap:8px;align-items:center;padding:0 16px}.bar u{width:12px;height:12px;border-radius:50%;background:#94a3b8;display:block}
b{display:block;height:14px;border-radius:7px;background:#e2e8f0;margin:12px 0}.grid{display:flex;gap:14px;margin-top:22px}.grid div{flex:1;height:110px;border-radius:12px;background:linear-gradient(135deg,${c2},${c1})}
.phone{width:250px;height:460px;border-radius:40px;background:#0f172a;padding:14px;box-shadow:0 40px 80px #0006}.scr{background:#fff;border-radius:28px;height:100%;padding:20px}
.hdr{height:120px;border-radius:16px;background:linear-gradient(135deg,${c2},${c1});margin-bottom:12px}.btn{height:44px;border-radius:22px;background:${c1};margin-top:24px}
.vid{height:290px;background:linear-gradient(135deg,${c1},#111);display:flex;align-items:center;justify-content:center}.vid span{font-size:70px;color:#fff}
.tl{display:flex;gap:6px;padding:20px}.tl s{flex:1;height:48px;border-radius:6px;background:${c2};text-decoration:none}
.bars{display:flex;gap:16px;align-items:flex-end;height:240px}.bars i{flex:1;background:linear-gradient(${c2},${c1});border-radius:8px 8px 0 0}
.kpi{font-family:J;font-weight:800;font-size:46px;color:${c1};margin-top:18px}
.chat p{padding:14px 18px;border-radius:16px;font-size:20px;margin:12px 0;max-width:80%}.u{background:#e2e8f0;margin-left:auto!important}.a{background:${c1};color:#fff}
.wave{display:flex;gap:6px;align-items:center;height:100%}.wave i{flex:1;background:${c1};border-radius:4px}
.canv{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px}.logo{width:170px;height:170px;border-radius:40px;background:linear-gradient(135deg,${c2},${c1});font-family:J;font-weight:800;font-size:110px;color:#fff;display:flex;align-items:center;justify-content:center}
.sw{display:flex;gap:14px}.sw i{width:56px;height:56px;border-radius:50%}
</style></head><body>${body}</body></html>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--allow-file-access-from-files"] });
  const p = await browser.newPage({ viewport: { width: 1280, height: 768 } });
  for (const g of GIGS) {
    for (let n = 0; n < 3; n++) {
      const tmp = path.join(require("os").tmpdir(), "gigimg.html");
      fs.writeFileSync(tmp, page(g, n));
      await p.goto("file://" + tmp);
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: path.join(OUT, `${slugify(g.title)}-${n}.jpg`), type: "jpeg", quality: 82 });
    }
  }
  await browser.close();
  console.log(`rendered ${GIGS.length * 3} images into ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
