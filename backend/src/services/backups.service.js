// Backup status for Admin → Backups. The "backup" compose service
// (scripts/backup.sh) writes archives and status.json into BACKUP_DIR,
// which the API mounts too.
const fs = require("fs/promises");
const path = require("path");

const DIR = () => process.env.BACKUP_DIR || "/backups";

async function status() {
  const dir = DIR();
  let files = [];
  try {
    const names = (await fs.readdir(dir)).filter((n) => /^qwlee-\d{8}T\d{6}Z\.archive\.gz$/.test(n));
    files = await Promise.all(names.map(async (name) => {
      const st = await fs.stat(path.join(dir, name));
      return { name, bytes: st.size, at: st.mtime };
    }));
    files.sort((a, b) => b.at - a.at);
  } catch {
    return { configured: false, dir, files: [], last: null, health: "not configured" };
  }
  let last = null;
  try { last = JSON.parse(await fs.readFile(path.join(dir, "status.json"), "utf8")); } catch {}
  const pending = await fs.stat(path.join(dir, "requests", "run-now")).then(() => true, () => false);
  const hours = Number(last?.intervalHours) || 24;
  const ageH = last?.at ? (Date.now() - Date.parse(last.at)) / 36e5 : null;
  const health = !last ? "never" : !last.ok ? "failing" : ageH > hours + 2 ? "stale" : "ok";
  return { configured: true, dir, last, files, health, pending, ageHours: ageH === null ? null : Math.round(ageH * 10) / 10 };
}

async function requestNow() {
  const dir = path.join(DIR(), "requests");
  try {
    await fs.writeFile(path.join(dir, "run-now"), new Date().toISOString());
  } catch (e) {
    const ApiError = require("../utils/ApiError");
    throw new ApiError(503, "The backup service isn't running (no writable backup folder)");
  }
  return { requested: true };
}

module.exports = { status, requestNow };
