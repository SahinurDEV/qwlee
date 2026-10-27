// Loads the on-disk policy markdown corpus (backend/data/policies).
// Chunk IDs look like policy:refund§5 and must stay stable for citations.
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "../../../data/policies");

let cache = null;

function load() {
  if (cache) return cache;
  const indexPath = path.join(DIR, "index.json");
  if (!fs.existsSync(indexPath)) {
    cache = { chunks: [], byId: new Map() };
    return cache;
  }
  const chunks = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const byId = new Map(chunks.map((c) => [c.id, c]));
  cache = { chunks, byId };
  return cache;
}

function allChunks() {
  return load().chunks;
}

function getChunk(id) {
  return load().byId.get(id) || null;
}

/** Simple keyword retrieval: score chunks by overlap with query tokens. */
function retrieve(query, { limit = 8, reasonCode = "" } = {}) {
  const q = `${reasonCode} ${query || ""}`.toLowerCase();
  const tokens = q.split(/[^a-z0-9§:]+/).filter((t) => t.length > 2);
  const scored = allChunks().map((c) => {
    const hay = `${c.id} ${c.heading} ${c.text}`.toLowerCase();
    let score = 0;
    for (const t of tokens) if (hay.includes(t)) score += 1;
    // Soft boosts for dispute-relevant docs
    if (c.doc === "refund" || c.doc === "terms-excerpt") score += 0.5;
    return { ...c, score };
  });
  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function validateCiteIds(ids = []) {
  const { byId } = load();
  const ok = [];
  const bad = [];
  for (const id of ids) {
    if (byId.has(id)) ok.push(id);
    else bad.push(id);
  }
  return { ok, bad };
}

module.exports = { load, allChunks, getChunk, retrieve, validateCiteIds, DIR };
