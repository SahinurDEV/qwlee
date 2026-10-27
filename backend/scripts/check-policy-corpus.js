const { allChunks, getChunk, retrieve, validateCiteIds } = require("../src/services/disputeAi/policyCorpus");
const chunks = allChunks();
if (chunks.length < 10) {
  console.error("expected >=10 policy chunks, got", chunks.length);
  process.exit(1);
}
for (const c of chunks) {
  if (!getChunk(c.id)) {
    console.error("missing", c.id);
    process.exit(1);
  }
}
const hits = retrieve("dispute refund delivery late", { limit: 5, reasonCode: "no_delivery" });
if (!hits.length) {
  console.error("retrieve returned nothing");
  process.exit(1);
}
const { bad } = validateCiteIds([hits[0].id, "policy:nope§1"]);
if (bad.length !== 1) {
  console.error("validateCiteIds failed", bad);
  process.exit(1);
}
console.log("ok", chunks.length, "chunks; top hit", hits[0].id);
