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

let child = null;
let restarting = false;

function start() {
  child = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    stdio: "inherit",
    env: { ...process.env, BIG_GACHA_SUPERVISED: "1" },
  });
  child.on("exit", (code, signal) => {
    child = null;
    if (restarting || code === RESTART_CODE) {
      restarting = false;
      console.log("\n↻ Redémarrage du serveur…\n");
      setTimeout(start, 300);
    } else if (code !== 0 && !shuttingDown) {
      console.log(`\n✖ Le serveur s'est arrêté (code ${code ?? signal}). Nouvel essai dans 3 s…\n`);
      setTimeout(start, 3000);
    } else if (!shuttingDown) {
      process.exit(code ?? 0);
    }
  });
}

function restart() {
  if (!child) return start();
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
