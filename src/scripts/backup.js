/**
 * Database backup / restore (no external tools needed).
 *
 *   npm run backup                      → backups/<date>/<collection>.json
 *   npm run restore -- <folder name>    → replaces every collection with the backup
 *
 * Uses MongoDB Extended JSON so ObjectIds and dates survive the round trip.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { EJSON } = require("bson");

const BACKUP_ROOT = path.join(__dirname, "..", "..", "backups");

async function backup({ label } = {}) {
  const db = mongoose.connection.db;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(BACKUP_ROOT, label ? `${stamp}_${label}` : stamp);
  fs.mkdirSync(dir, { recursive: true });

  const collections = await db.listCollections().toArray();
  let total = 0;
  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(path.join(dir, `${name}.json`), EJSON.stringify(docs, { relaxed: false }));
    total += docs.length;
    console.log(`  ✓ ${name}: ${docs.length}`);
  }
  console.log(`Backup: ${total} documents → ${dir}`);
  return dir;
}

async function restore(folder) {
  const dir = path.isAbsolute(folder) ? folder : path.join(BACKUP_ROOT, folder);
  if (!fs.existsSync(dir)) throw new Error(`Backup not found: ${dir}`);
  const db = mongoose.connection.db;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const name = file.replace(/\.json$/, "");
    const docs = EJSON.parse(fs.readFileSync(path.join(dir, file), "utf8"), { relaxed: false });
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs);
    console.log(`  ✓ ${name}: ${docs.length}`);
  }
  console.log(`Restored from ${dir}`);
}

/**
 * Back up only one game's documents (used automatically before each sync).
 * Folder: backups/<date>_<label>/ with one file per collection.
 */
async function backupGame(game, label) {
  const db = mongoose.connection.db;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const name = `${stamp}_${label || `auto-${game}`}`;
  const dir = path.join(BACKUP_ROOT, name);
  fs.mkdirSync(dir, { recursive: true });
  let total = 0;
  for (const { name: coll } of await db.listCollections().toArray()) {
    if (coll.startsWith("system.") || coll === "sync_state" || coll === "changelog") continue;
    const docs = await db.collection(coll).find({ game }).toArray();
    if (!docs.length) continue;
    fs.writeFileSync(path.join(dir, `${coll}.json`), EJSON.stringify(docs, { relaxed: false }));
    total += docs.length;
  }
  fs.writeFileSync(path.join(dir, "_meta.json"), JSON.stringify({ game, createdAt: new Date().toISOString(), total }));
  return name;
}

/** Restore one game from a backupGame() folder: that game's documents are replaced. */
async function restoreGame(game, folder) {
  const dir = path.isAbsolute(folder) ? folder : path.join(BACKUP_ROOT, folder);
  if (!fs.existsSync(dir)) throw new Error(`Backup not found: ${dir}`);
  const db = mongoose.connection.db;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const restoredCollections = new Set();
  for (const file of files) {
    const coll = file.replace(/\.json$/, "");
    const docs = EJSON.parse(fs.readFileSync(path.join(dir, file), "utf8"), { relaxed: false });
    await db.collection(coll).deleteMany({ game });
    if (docs.length) await db.collection(coll).insertMany(docs);
    restoredCollections.add(coll);
  }
  // Documents added for this game in collections that had none at backup time
  for (const { name: coll } of await db.listCollections().toArray()) {
    if (restoredCollections.has(coll) || coll.startsWith("system.") || coll === "sync_state" || coll === "changelog") continue;
    await db.collection(coll).deleteMany({ game });
  }
}

/** Keep only the `keep` most recent automatic backups of a game. */
function pruneAutoBackups(game, keep = 3) {
  const auto = listBackups().filter((d) => d.endsWith(`_auto-${game}`));
  for (const old of auto.slice(0, Math.max(0, auto.length - keep))) {
    fs.rmSync(path.join(BACKUP_ROOT, old), { recursive: true, force: true });
  }
}

function listBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return [];
  return fs.readdirSync(BACKUP_ROOT).filter((d) => fs.statSync(path.join(BACKUP_ROOT, d)).isDirectory()).sort();
}

module.exports = { backup, restore, backupGame, restoreGame, pruneAutoBackups, listBackups, BACKUP_ROOT };

if (require.main === module) {
  const connectDB = require("../config/db");
  const [cmd, arg] = process.argv.slice(2);
  (async () => {
    await connectDB();
    if (cmd === "restore") {
      if (!arg) {
        console.log("Usage: npm run restore -- <folder>\nAvailable:\n  " + listBackups().join("\n  "));
      } else {
        await restore(arg);
      }
    } else {
      await backup({ label: arg });
    }
    await mongoose.connection.close();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
