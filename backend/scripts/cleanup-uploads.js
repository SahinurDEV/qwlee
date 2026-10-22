// Usage: npm run cleanup:uploads            (dry run, lists orphans)
//        npm run cleanup:uploads -- --apply (delete them)
//        --min-age-hours=48                 (default 24)
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  const apply = process.argv.includes("--apply");
  const age = Number((process.argv.find((a) => a.startsWith("--min-age-hours=")) || "").split("=")[1]) || 24;
  const r = await require("../src/services/uploadsCleanup.service").run({ apply, minAgeHours: age });
  console.log(JSON.stringify(r));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
