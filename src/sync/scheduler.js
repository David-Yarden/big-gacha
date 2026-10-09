/**
 * Automatic synchronisation while the app is running.
 *
 *   - at start-up: sync if the last check is older than the interval (or never happened)
 *   - then every SYNC_INTERVAL_HOURS (default 6)
 *
 * Disable with SYNC_AUTO=false in .env.
 */
const { runAll, isRunning, ADAPTERS } = require("./engine");
const { SyncState } = require("../models");

const HOURS = Number(process.env.SYNC_INTERVAL_HOURS) || 6;
const INTERVAL_MS = HOURS * 3600 * 1000;
const STARTUP_DELAY_MS = 15 * 1000;

let timer = null;
let nextRunAt = null;

async function isDue() {
  const games = Object.keys(ADAPTERS);
  const states = await SyncState.find({ game: { $in: games } }).lean();
  if (states.length < games.length) return true;
  const oldest = Math.min(...states.map((s) => (s.lastCheckAt ? new Date(s.lastCheckAt).getTime() : 0)));
  return Date.now() - oldest >= INTERVAL_MS;
}

async function tick(reason) {
  if (isRunning()) return;
  try {
    console.log(`🔄 Synchro automatique (${reason})…`);
    const results = await runAll();
    for (const r of results) {
      const detail = r.added ? ` +${r.added.length} / ~${r.changed.length}` : "";
      console.log(`   ${r.game}: ${r.status}${detail}${r.errors?.length ? ` — ${r.errors[0]}` : ""}`);
    }
  } catch (err) {
    console.warn("⚠  Synchro automatique en échec :", err.message);
  }
}

function start() {
  if (process.env.SYNC_AUTO === "false") {
    console.log("⏸  Synchro automatique désactivée (SYNC_AUTO=false)");
    return;
  }
  setTimeout(async () => {
    if (await isDue().catch(() => false)) await tick("démarrage");
    nextRunAt = new Date(Date.now() + INTERVAL_MS);
    timer = setInterval(() => {
      nextRunAt = new Date(Date.now() + INTERVAL_MS);
      tick(`toutes les ${HOURS} h`);
    }, INTERVAL_MS);
    timer.unref?.();
  }, STARTUP_DELAY_MS).unref?.();
  console.log(`⏱  Synchro automatique : au démarrage si besoin, puis toutes les ${HOURS} h`);
}

function schedulerInfo() {
  return { enabled: process.env.SYNC_AUTO !== "false", intervalHours: HOURS, nextRunAt };
}

module.exports = { start, schedulerInfo };
