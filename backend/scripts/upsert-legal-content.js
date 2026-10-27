/**
 * Idempotent: push Privacy / Terms / Trust HTML from backend/data/legal into Mongo.
 * Usage: MONGODB_URL=... npm run legal:upsert
 */
try { require("dotenv").config({ path: require("path").join(__dirname, "../.env") }); } catch (_) {}
const mongoose = require("mongoose");
require("../src/models");
const { upsertLegalContent, PRIVACY, TERMS } = require("../seeders/contentSeeder");

async function main() {
  const url = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017/qwlee";
  await mongoose.connect(url);
  const r = await upsertLegalContent();
  const checks = {
    privacyHasOpenRouter: /OpenRouter/i.test(r.privacy.content || ""),
    privacyNoSeedStub: !/seed content/i.test(r.privacy.content || ""),
    termsNoTenPercent: !/10% service fee/i.test(r.terms.content || ""),
    termsHasFivePercent: /5%/i.test(r.terms.content || ""),
    privacyLen: (r.privacy.content || "").length,
    termsLen: (r.terms.content || "").length,
  };
  console.log(JSON.stringify(checks));
  if (!checks.privacyHasOpenRouter || !checks.privacyNoSeedStub || !checks.termsNoTenPercent) process.exitCode = 1;
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
