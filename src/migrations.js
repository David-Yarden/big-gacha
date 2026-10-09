/**
 * One-time data clean-ups, run at every start (each is idempotent and cheap).
 */
const { Talent, Constellation, Trace, Eidolon } = require("./models");

/**
 * Kit enhancements used to be stored on the documents (talent.hexerei, trace.novaflare…).
 * They now live in shared/games/<game>/enhancements/*.yaml: drop the old copies.
 * (Raw collection calls: the fields are no longer in the schemas.)
 */
async function dropLegacyKitFields() {
  const jobs = [
    [Talent, "hexerei"],
    [Constellation, "hexerei"],
    [Trace, "novaflare"],
    [Eidolon, "novaflare"],
  ];
  let total = 0;
  for (const [Model, field] of jobs) {
    const r = await Model.collection.updateMany({ [field]: { $exists: true } }, { $unset: { [field]: "" } });
    total += r.modifiedCount || 0;
  }
  if (total) console.log(`🧹 Anciens champs d'améliorations retirés de ${total} document(s)`);
}

async function runMigrations() {
  for (const step of [dropLegacyKitFields]) {
    await step().catch((err) => console.warn(`⚠  Migration ${step.name}: ${err.message}`));
  }
}

module.exports = { runMigrations };
