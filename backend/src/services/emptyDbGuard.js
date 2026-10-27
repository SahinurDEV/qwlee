// Empty-database guard.
//
// The live demo once came back with an empty database: the Docker volumes
// were recreated (fresh volume after the Docker data was reset) and nobody
// re-ran the seeder, so the site had no users or gigs. On start-up we now
// check for users and, when there are none:
//   - always log a loud warning, and
//   - when SEED_DEMO_IF_EMPTY=true, run the demo seeder once.
// A database that has any user is never touched.
const path = require("path");
const { spawn } = require("child_process");
const mongoose = require("mongoose");
const logger = require("../config/logger");

let lastStatus = { checkedAt: null, empty: null, seeded: false };

const enabled = () => String(process.env.SEED_DEMO_IF_EMPTY || "").toLowerCase() === "true";

function runSeeder() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, "../../seeders/index.js")], {
      env: process.env,
      stdio: ["ignore", "ignore", "inherit"],
    });
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

async function check({ seed = runSeeder } = {}) {
  const users = await mongoose.connection.db.collection("users").estimatedDocumentCount();
  lastStatus = { checkedAt: new Date(), empty: users === 0, seeded: false };
  if (users > 0) return lastStatus;
  logger.warn("Database has no users. If this is unexpected, restore a backup (see README → Backups).");
  if (!enabled()) return lastStatus;
  // Never auto-seed a production database unless explicitly overridden.
  const allowProd = String(process.env.ALLOW_DEMO_SEED_IN_PROD || "").toLowerCase() === "true";
  if (process.env.NODE_ENV === "production" && !allowProd) {
    logger.error(
      "SEED_DEMO_IF_EMPTY=true but NODE_ENV=production — refusing to seed. Set ALLOW_DEMO_SEED_IN_PROD=true to override (demo hosts only)."
    );
    return lastStatus;
  }
  // Re-check right before seeding so two replicas don't both seed.
  const again = await mongoose.connection.db.collection("users").estimatedDocumentCount();
  if (again > 0) return lastStatus;
  logger.warn("SEED_DEMO_IF_EMPTY=true: loading demo data");
  lastStatus.seeded = await seed();
  logger.info(lastStatus.seeded ? "Demo data loaded" : "Demo seeding failed");
  return lastStatus;
}

module.exports = { check, enabled, status: () => lastStatus };
