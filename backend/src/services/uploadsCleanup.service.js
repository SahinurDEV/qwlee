// Finds (and optionally deletes) locally stored uploads that nothing in
// the database points to any more — e.g. images removed from a gig, an
// old avatar, a replaced ID document. Files younger than `minAgeHours`
// are always kept so an upload that is mid-way through a form is safe.
// Images hosted on ImgBB are not touched (ImgBB has no delete without
// the per-image delete URL, which we don't keep).
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const { UPLOAD_DIR } = require("./imageUpload.service");
const { PRIVATE_DIR } = require("./privateFiles.service");

const FILE = /[a-f0-9]{32}\.(?:jpg|png|gif|webp)/g;

async function referencedNames() {
  const names = new Set();
  const db = mongoose.connection.db;
  for (const { name } of await db.listCollections().toArray()) {
    if (name.startsWith("system.")) continue;
    for await (const doc of db.collection(name).find({})) {
      const s = JSON.stringify(doc);
      for (const m of s.matchAll(FILE)) names.add(m[0]);
    }
  }
  return names;
}

async function listDir(dir) {
  try {
    const out = [];
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.isFile() && /^[a-f0-9]{32}\.(jpg|png|gif|webp)$/.test(e.name)) {
        const st = await fs.stat(path.join(dir, e.name));
        out.push({ dir, name: e.name, size: st.size, mtime: st.mtimeMs });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function run({ apply = false, minAgeHours = 24 } = {}) {
  const refs = await referencedNames();
  const cutoff = Date.now() - minAgeHours * 3600 * 1000;
  const files = [...(await listDir(UPLOAD_DIR)), ...(await listDir(PRIVATE_DIR))];
  const orphans = files.filter((f) => !refs.has(f.name) && f.mtime < cutoff);
  let deleted = 0;
  if (apply) {
    for (const f of orphans) {
      try {
        await fs.unlink(path.join(f.dir, f.name));
        deleted++;
      } catch { /* already gone */ }
    }
  }
  return {
    scanned: files.length,
    orphans: orphans.length,
    orphanBytes: orphans.reduce((n, f) => n + f.size, 0),
    deleted,
    applied: apply,
    sample: orphans.slice(0, 10).map((f) => f.name),
  };
}

module.exports = { run };
