// Empty-database guard: seeds only when there are no users and the flag is on.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const Module = require("module");

// Load the guard with a fake mongoose + logger so this runs without a DB.
function loadGuard(userCounts) {
  const counts = [...userCounts];
  const fakeMongoose = { connection: { db: { collection: () => ({ estimatedDocumentCount: async () => counts.shift() }) } } };
  const fakeLogger = { warn() {}, info() {}, error() {} };
  const orig = Module._load;
  Module._load = function (req, parent, ...rest) {
    if (req === "mongoose") return fakeMongoose;
    if (req.endsWith("config/logger")) return fakeLogger;
    return orig.call(this, req, parent, ...rest);
  };
  const p = path.join(__dirname, "../src/services/emptyDbGuard.js");
  delete require.cache[p];
  try { return require(p); } finally { Module._load = orig; }
}

test("guard never seeds a database that has users", async () => {
  process.env.SEED_DEMO_IF_EMPTY = "true";
  let seeded = 0;
  const s = await loadGuard([3]).check({ seed: async () => { seeded++; return true; } });
  assert.equal(s.empty, false);
  assert.equal(seeded, 0);
});

test("guard seeds an empty database only when SEED_DEMO_IF_EMPTY=true", async () => {
  let seeded = 0;
  const seed = async () => { seeded++; return true; };
  process.env.SEED_DEMO_IF_EMPTY = "false";
  assert.equal((await loadGuard([0]).check({ seed })).seeded, false);
  process.env.SEED_DEMO_IF_EMPTY = "true";
  assert.equal((await loadGuard([0, 0]).check({ seed })).seeded, true);
  // Someone else seeded between the two checks: leave it alone.
  assert.equal((await loadGuard([0, 5]).check({ seed })).seeded, false);
  assert.equal(seeded, 1);
  delete process.env.SEED_DEMO_IF_EMPTY;
});
