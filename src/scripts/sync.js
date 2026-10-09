/**
 * Command-line synchronisation.
 *
 *   npm run sync                         → every game with an adapter
 *   npm run sync -- --game hsr           → one game
 *   npm run sync -- --dry-run            → report only, nothing written
 *   npm run sync -- --force              → re-import even if the source did not change
 *   npm run sync:rollback -- --game hsr  → undo the last applied sync of a game
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { runSync, runAll, rollback } = require("../sync/engine");

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name) => args.includes(`--${name}`);

function printReport(r) {
  console.log(`\n■ ${r.game} — ${r.status}${r.dryRun ? " (dry run)" : ""}`);
  if (r.gameVersion) console.log(`  game version: ${r.gameVersion}`);
  if (r.upstreamAfter) console.log(`  source: ${r.upstreamBefore || "—"} → ${r.upstreamAfter}`);
  for (const n of r.notes || []) console.log(`  note: ${n}`);
  if (r.added) console.log(`  added: ${r.added.length}  changed: ${r.changed.length}  missing from source: ${r.missing.length}`);
  for (const a of (r.added || []).slice(0, 30)) console.log(`    + ${a.model} ${a.name}`);
  for (const c of (r.changed || []).slice(0, 30)) console.log(`    ~ ${c.model} ${c.name} (${c.fields.join(", ")})`);
  for (const e of r.errors || []) console.log(`  ✗ ${e}`);
  for (const w of r.warnings || []) console.log(`  ! ${w}`);
  if (r.backup) console.log(`  backup: backups/${r.backup}`);
}

(async () => {
  await connectDB();
  const game = arg("game");
  try {
    if (has("rollback")) {
      if (!game) throw new Error("--game is required for a rollback");
      console.log(await rollback(game));
    } else {
      const options = { dryRun: has("dry-run"), force: has("force") };
      const results = game ? [await runSync(game, options)] : await runAll(options);
      results.forEach(printReport);
    }
  } catch (err) {
    console.error("Sync failed:", err.message);
    process.exitCode = 1;
  }
  await mongoose.connection.close();
})();
