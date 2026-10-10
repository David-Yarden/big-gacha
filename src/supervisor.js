/**
 * Development supervisor: runs the API and restarts it
 *   - when a file under src/ or shared/ changes (polling: works for any kind of write),
 *   - when the API asks for it (POST /api/admin/restart → exit code 75),
 *   - after a crash (3 s later, so a typo being fixed does not spin).
 *
 * Run: npm run dev
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WATCH = ["src", "shared"].map((d) => path.join(ROOT, d));
const EXTS = new Set([".js", ".json", ".yaml", ".yml"]);
const RESTART_CODE = 75;

const PORT_IN_USE = 98; // server.js: another server already listens on the port

let child = null;
let restarting = false;
let startTimer = null; // a start already scheduled (never two servers at once)

function scheduleStart(ms) {
  if (child || startTimer) return;
  startTimer = setTimeout(() => {
    startTimer = null;
    start();
  }, ms);
}

function start() {
  if (child) return;
  const proc = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    stdio: "inherit",
    env: { ...process.env, BIG_GACHA_SUPERVISED: "1" },
  });
  child = proc;
  proc.on("exit", (code, signal) => {
    // Only the current server decides what happens next
    if (child !== proc) return;
    child = null;
    if (shuttingDown) return;
    if (restarting || code === RESTART_CODE) {
      restarting = false;
      console.log("\n↻ Redémarrage du serveur…\n");
      scheduleStart(300);
    } else if (code === PORT_IN_USE) {
      console.log("\n✖ Le port est déjà pris par un autre serveur (un ancien Big Gacha ?). Nouvel essai dans 10 s…\n");
      scheduleStart(10_000);
    } else if (code !== 0) {
      console.log(`\n✖ Le serveur s'est arrêté (code ${code ?? signal}). Nouvel essai dans 3 s…\n`);
      scheduleStart(3000);
    } else {
      process.exit(0);
    }
  });
}

function restart() {
  if (!child) return scheduleStart(300);
  restarting = true;
  child.kill();
}

/** path → "mtime:size" for every watched file. */
function snapshot() {
  const out = new Map();
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (EXTS.has(path.extname(e.name))) {
        try {
          const st = fs.statSync(p);
          out.set(p, `${st.mtimeMs}:${st.size}`);
        } catch {
          /* deleted meanwhile */
        }
      }
    }
  };
  WATCH.forEach(walk);
  return out;
}

function differs(a, b) {
  if (a.size !== b.size) return true;
  for (const [k, v] of a) if (b.get(k) !== v) return true;
  return false;
}

let last = snapshot();
let pending = false;
setInterval(() => {
  const now = snapshot();
  if (differs(now, last)) {
    last = now;
    pending = true; // wait until writes settle (one more quiet tick)
  } else if (pending) {
    pending = false;
    console.log("\n✎ Fichiers modifiés détectés.");
    restart();
  }
}, 1500);

let shuttingDown = false;
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    shuttingDown = true;
    if (child) child.kill(sig);
    process.exit(0);
  });
}

start();
