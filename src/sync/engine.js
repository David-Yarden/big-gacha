/**
 * Synchronisation engine.
 *
 *   1. check     — ask the source for its latest version; stop if nothing changed
 *   2. collect   — run the game's seeders in "recording" mode (nothing is written)
 *   3. diff      — compare with the database: added / changed / missing documents
 *   4. validate  — schema + sanity checks; any error = nothing is published
 *   5. backup    — save the game's current documents (for rollback)
 *   6. apply     — write the changes, log them in the changelog
 */
const mongoose = require("mongoose");
const sink = require("./sink");
const ADAPTERS = require("./adapters");
const { SyncState, Changelog } = require("../models");
const { backupGame, restoreGame, pruneAutoBackups } = require("../scripts/backup");
const { attachTranslations } = require("./i18n");

let running = null; // game currently syncing (one sync at a time)

/** Banner seeder, re-read on each use so its code updates apply without a restart */
function bannersModule() {
  delete require.cache[require.resolve("../scripts/seedBanners")];
  return require("../scripts/seedBanners");
}

function isRunning() {
  return running;
}

// ── Comparison helpers ────────────────────────────────────────────────────────

/** Stable JSON: sorted keys, null/undefined object values dropped (missing == null). */
function canon(value) {
  // Dates compare by value (as objects they have no keys and would look "empty")
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if (value._bsontype === "ObjectId") return String(value);
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const v = canon(value[key]);
      // null, undefined and {} all mean "nothing" (Mongoose drops empty objects on one side only)
      if (v === null || v === undefined || v === "") continue;
      if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      out[key] = v;
    }
    return out;
  }
  return value;
}

/** Path of the first difference between two values (diagnostics). */
function firstDiff(a, b, path = "") {
  const ca = canon(a), cb = canon(b);
  if (JSON.stringify(ca) === JSON.stringify(cb)) return null;
  if (ca && cb && typeof ca === "object" && typeof cb === "object") {
    const keys = [...new Set([...Object.keys(ca), ...Object.keys(cb)])];
    for (const k of keys) {
      const d = firstDiff(ca[k], cb[k], `${path}.${k}`);
      if (d) return d;
    }
  }
  return { path, new: JSON.stringify(ca)?.slice(0, 300), db: JSON.stringify(cb)?.slice(0, 300) };
}

function same(a, b) {
  // Wrapped so that "", null, undefined and {} are equal at the top level too
  return JSON.stringify(canon({ v: a })) === JSON.stringify(canon({ v: b }));
}

const IGNORED_FIELDS = new Set(["game", "name", "_id", "__v", "createdAt", "updatedAt"]);

// ── Steps ─────────────────────────────────────────────────────────────────────

function collapseDuplicates(ops) {
  const lastIndex = new Map();
  ops.forEach((op, i) => {
    if (op.op === "upsert" && typeof op.filter?.name === "string") lastIndex.set(`${op.model}\u0000${op.filter.name}`, i);
  });
  return ops.filter((op, i) =>
    op.op !== "upsert" || typeof op.filter?.name !== "string" || lastIndex.get(`${op.model}\u0000${op.filter.name}`) === i
  );
}

async function loadExisting(game, modelNames) {
  const existing = {};
  for (const modelName of modelNames) {
    const Model = mongoose.model(modelName);
    const docs = await Model.find({ game }).lean();
    existing[modelName] = new Map(docs.map((d) => [d.name, d]));
  }
  return existing;
}

function computeDiff(ops, existing, gameVersion, { resetVersions = false } = {}) {
  const added = [];
  const changed = [];
  const samples = {}; // first difference per model.field (diagnostics, dry runs only)
  const touched = {}; // model → Set(names) present in the source

  for (const op of ops) {
    const name = op.filter?.name;
    const byName = existing[op.model];
    if (op.op === "delete") {
      const names = op.filter?.name?.$in ?? (typeof name === "string" ? [name] : []);
      for (const n of names) {
        if (byName?.has(n)) changed.push({ model: op.model, name: n, fields: ["(deleted)"] });
      }
      continue;
    }
    if (typeof name !== "string") continue;
    (touched[op.model] ||= new Set()).add(name);

    const current = byName?.get(name);
    const Model = mongoose.model(op.model);
    const hasVersion = !!Model.schema.path("version");

    if (hasVersion && op.set.version == null && resetVersions) {
      // Manual repair: drop versions the source does not give (they were guessed)
      delete op.set.version;
      if (current?.version) op.unset = { ...(op.unset || {}), version: "" };
    } else if (hasVersion && op.set.version == null && current?.version) {
      // Never erase a known release version with an empty one from the source
      delete op.set.version;
    }

    if (!current) {
      // New entity: date it with the game version the source announces — but not on a
      // collection's first import, where everything would wrongly get today's version
      const firstImport = !byName || byName.size === 0;
      if (hasVersion && op.set.version == null && gameVersion && !firstImport && !resetVersions) {
        op.set.version = gameVersion;
      }
      added.push({ model: op.model, name });
      continue;
    }

    // Compare what would actually be stored: cast through the schema, which drops
    // fields the database does not keep (otherwise they would look "changed" forever)
    const stored = new Model({ ...op.filter, ...op.set }).toObject();
    const fields = Object.keys(op.set).filter((k) => !IGNORED_FIELDS.has(k) && !same(stored[k], current[k]));
    for (const k of Object.keys(op.unset || {})) {
      if (current[k] !== undefined) fields.push(k);
    }
    if (fields.length) {
      changed.push({ model: op.model, name, fields });
      const key = `${op.model}.${fields[0]}`;
      if (!samples[key]) {
        samples[key] = { name, ...firstDiff(stored[fields[0]], current[fields[0]], fields[0]) };
      }
    }
  }

  const missing = [];
  for (const [model, names] of Object.entries(touched)) {
    for (const name of existing[model]?.keys() ?? []) {
      if (!names.has(name)) missing.push({ model, name });
    }
  }
  return { added, changed, missing, touched, samples };
}

/** Is an image value usable? (a URL string, not undefined/empty) */
function hasImage(images) {
  return !!images && Object.values(images).some((v) => typeof v === "string" && v.length > 0);
}

function validate(ops, existing, touched, { prune = false, expect = {} } = {}) {
  const errors = [];
  const warnings = [];

  // The adapter's contract: each collection it owns must come back, with a minimum size.
  // Catches upstream format changes that silently produce an empty or tiny collection.
  for (const [model, min] of Object.entries(expect)) {
    const n = touched[model]?.size ?? 0;
    if (n === 0) errors.push(`${model}: nothing produced by the source (format changed?)`);
    else if (n < min) errors.push(`${model}: only ${n} in the source (at least ${min} expected)`);
  }

  // Every document must be valid for its schema
  let schemaErrors = 0;
  for (const op of ops) {
    if (op.op === "delete") continue;
    if (typeof op.filter?.name !== "string" || !op.filter.name.trim()) {
      errors.push(`${op.model}: document without a name`);
      continue;
    }
    const Model = mongoose.model(op.model);
    const doc = new Model({ ...op.filter, ...op.set });
    const err = doc.validateSync();
    if (err) {
      schemaErrors++;
      if (schemaErrors <= 10) errors.push(`${op.model} "${op.filter.name}": ${err.message}`);
    }
  }
  if (schemaErrors > 10) errors.push(`… and ${schemaErrors - 10} more schema errors`);

  // A source that suddenly lost many entries is probably broken
  for (const [model, names] of Object.entries(touched)) {
    // Banner histories only grow; a renamed banner is replaced by the seeder itself
    // (an unreachable source throws instead of returning less)
    if (model === "Banner") continue;
    const before = existing[model]?.size ?? 0;
    if (before >= 20 && names.size < before * 0.9) {
      // An explicit cleanup is expected to shrink the collection: warn only
      (prune ? warnings : errors).push(`${model}: ${names.size} in the source vs ${before} in the database (> 10 % drop)`);
    }
  }

  // Characters should come with a picture
  const chars = ops.filter((o) => o.model === "Character" && o.op === "upsert");
  const noImage = chars.filter((o) => !hasImage(o.set.images));
  if (chars.length && noImage.length > chars.length * 0.2) {
    errors.push(`${noImage.length}/${chars.length} characters without any image (image source changed?)`);
  } else if (noImage.length) {
    warnings.push(`${noImage.length} character(s) without images: ${noImage.slice(0, 5).map((o) => o.filter.name).join(", ")}`);
  }

  return { errors, warnings };
}

async function apply(ops) {
  const byModel = new Map();
  for (const op of ops) {
    const list = byModel.get(op.model) || [];
    if (op.op === "delete") {
      list.push({ deleteMany: { filter: op.filter } });
    } else {
      const update = { $set: op.set };
      if (op.unset && Object.keys(op.unset).length) update.$unset = op.unset;
      list.push({ updateOne: { filter: op.filter, update, upsert: true } });
    }
    byModel.set(op.model, list);
  }
  for (const [modelName, list] of byModel) {
    const Model = mongoose.model(modelName);
    for (let i = 0; i < list.length; i += 500) {
      await Model.bulkWrite(list.slice(i, i + 500), { ordered: false });
    }
  }
}

/** Keep the last 100 changelog entries per game. */
async function trimChangelog(game, keep = 100) {
  const old = await Changelog.find({ game }).sort({ createdAt: -1 }).skip(keep).select("_id").lean();
  if (old.length) await Changelog.deleteMany({ _id: { $in: old.map((o) => o._id) } });
}

async function countsFor(game, modelNames) {
  const counts = {};
  for (const m of modelNames) counts[m] = await mongoose.model(m).countDocuments({ game });
  return counts;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Synchronise one game.
 * @param {string} game
 * @param {{ dryRun?: boolean, force?: boolean }} options
 *   dryRun — report only, write nothing
 *   force  — re-import even if the source version did not change
 *   prune  — also delete documents that are no longer in the source (manual only)
 *   resetVersions — remove release versions the source does not provide (manual repair)
 */
async function runSync(game, { dryRun = false, force = false, prune = false, resetVersions = false } = {}) {
  const adapter = ADAPTERS[game];
  if (!adapter) throw Object.assign(new Error(`No sync adapter for "${game}"`), { statusCode: 400 });
  if (running) throw Object.assign(new Error(`A sync is already running (${running})`), { statusCode: 409 });

  running = game;
  const started = Date.now();
  const state = (await SyncState.findOne({ game })) || new SyncState({ game, source: adapter.source });
  const report = { game, dryRun, source: adapter.source, startedAt: new Date(started).toISOString() };

  try {
    // 1. check
    const check = await adapter.check(state.upstreamVersion || null);
    report.upstreamBefore = state.upstreamVersion || null;
    report.upstreamAfter = check.upstreamVersion;
    report.notes = check.notes || [];
    state.lastCheckAt = new Date();

    // Banner history: its own sources (wikis…) — a new banner triggers a sync by itself
    let bannerSig = null;
    try {
      bannerSig = await bannersModule().bannerSignature(game);
    } catch (err) {
      report.notes.push(`Bannières : source injoignable (${err.message})`);
    }
    const bannersChanged = !!bannerSig && bannerSig !== state.bannersVersion;

    // A version the user rolled back is not re-imported until the source moves on
    if (!force && state.skippedUpstream && state.skippedUpstream === check.upstreamVersion) {
      state.lastStatus = "up-to-date";
      await state.save();
      return {
        ...report,
        status: "up-to-date",
        notes: [...report.notes, `Version ${check.upstreamVersion} ignorée (annulée par toi)`],
        durationMs: Date.now() - started,
      };
    }

    // New commits that touch none of the files we read: just remember the new revision
    if (!force && check.irrelevant && !bannersChanged) {
      state.upstreamVersion = check.upstreamVersion;
      state.gameVersion = check.gameVersion || state.gameVersion;
      state.lastStatus = "up-to-date";
      state.lastError = undefined;
      await state.save();
      return {
        ...report,
        status: "up-to-date",
        notes: [...report.notes, "Nouveaux commits sans changement des données utilisées"],
        durationMs: Date.now() - started,
      };
    }

    const unchanged = state.upstreamVersion === check.upstreamVersion && !check.needsPackageUpdate;
    if (unchanged && !force && !bannersChanged) {
      state.lastStatus = "up-to-date";
      state.lastError = undefined;
      await state.save();
      return { ...report, status: "up-to-date", durationMs: Date.now() - started };
    }

    // 2. collect
    if (!dryRun && adapter.prepare) await adapter.prepare(check);
    sink.startRecording();
    let ops;
    let bannerError = null;
    try {
      await adapter.collect(check);
      // Banners last: they link to the characters and weapons recorded just before
      try {
        await bannersModule().seedBanners(game);
      } catch (err) {
        bannerError = err.message;
        report.notes.push(`Bannières non mises à jour : ${err.message}`);
      }
    } finally {
      ops = sink.stopRecording();
    }

    // Official translations: the same seeders again in each other language, their texts
    // attached to the English documents (i18n.<lang>). A failure keeps the previous ones.
    for (const lang of adapter.languages || []) {
      let langOps = null;
      sink.startRecording();
      try {
        await adapter.collect({ ...check, lang });
        langOps = sink.stopRecording();
      } catch (err) {
        sink.stopRecording();
        report.notes.push(`Textes « ${lang} » non mis à jour : ${err.message}`);
      }
      if (langOps) {
        const stats = attachTranslations(ops, langOps, lang);
        const missed = Object.entries(stats)
          .filter(([, s]) => s.unmatched > 0)
          .map(([m, s]) => `${m} ${s.unmatched} (${s.names.join(", ")}${s.unmatched > s.names.length ? "…" : ""})`);
        if (missed.length) report.notes.push(`Textes « ${lang} » sans correspondance : ${missed.join(", ")}`);
      }
    }
    const gameVersion = check.gameVersion || adapter.detectGameVersion?.(ops) || state.gameVersion || null;
    report.gameVersion = gameVersion;
    report.operations = ops.length;

    // Several source entries can share a name (e.g. HSR items): only the last write
    // survives in the database, so keep only that one for the diff and the apply.
    ops = collapseDuplicates(ops);
    report.operations = ops.length;

    // 3. diff
    const modelNames = [...new Set(ops.map((o) => o.model))];
    const existing = await loadExisting(game, modelNames);
    const { added, changed, missing, touched, samples } = computeDiff(ops, existing, gameVersion, { resetVersions });
    Object.assign(report, { added, changed, missing });
    if (dryRun) report.samples = samples;

    // 4. validate
    const { errors, warnings } = validate(ops, existing, touched, { prune, expect: adapter.expect });
    Object.assign(report, { errors, warnings });

    if (errors.length) {
      report.status = "failed";
      if (!dryRun && adapter.undoPrepare) {
        await adapter.undoPrepare(check).catch((e) => warnings.push(`undo: ${e.message}`));
      }
      if (!dryRun) {
        state.lastStatus = "failed";
        state.lastError = errors[0];
        state.unseen = true;
        await state.save();
        await Changelog.create({
          game, status: "failed", upstreamBefore: report.upstreamBefore, upstreamAfter: report.upstreamAfter,
          gameVersion, added, changed, missing, problems: errors, warnings, durationMs: Date.now() - started,
        });
        await trimChangelog(game);
      }
      return { ...report, durationMs: Date.now() - started };
    }

    if (dryRun) {
      return { ...report, status: "dry-run", durationMs: Date.now() - started };
    }

    // 5. backup, 6. apply
    const pruned = prune ? missing : [];
    const hasChanges = added.length > 0 || changed.length > 0 || pruned.length > 0;
    if (hasChanges) {
      report.backup = await backupGame(game);
      pruneAutoBackups(game, 3);
      // Only write what differs (unchanged documents keep their updatedAt)
      const touchedNames = new Set([...added, ...changed].map((c) => `${c.model}\u0000${c.name}`));
      const toWrite = ops.filter((o) => o.op === "delete" || touchedNames.has(`${o.model}\u0000${o.filter?.name}`));
      try {
        await apply([
          ...toWrite,
          ...pruned.map((m) => ({ op: "delete", model: m.model, filter: { game, name: m.name } })),
        ]);
      } catch (err) {
        // A half-written database is worse than none: put the backup back
        await restoreGame(game, report.backup).catch(() => {});
        throw new Error(`Writing failed, previous data restored: ${err.message}`);
      }
      if (pruned.length) {
        report.pruned = pruned.length;
        warnings.push(`${pruned.length} document(s) absent from the source deleted`);
      }
      await Changelog.create({
        game, status: "applied", upstreamBefore: report.upstreamBefore, upstreamAfter: report.upstreamAfter,
        gameVersion, added, changed, missing, warnings, backup: report.backup,
        counts: await countsFor(game, modelNames), durationMs: Date.now() - started,
      });
      await trimChangelog(game);
    }

    // New images: copied locally in the background (src/sync/imageMirror.js)
    if (hasChanges) setTimeout(() => require("./imageMirror").mirrorImages().catch(() => {}), 1000).unref?.();

    // New characters may now match enhancement files that referenced them
    if (hasChanges) {
      await require("../enhancements/loader").loadEnhancements().catch((e) => report.warnings.push(`enhancements: ${e.message}`));
    }

    state.upstreamVersion = check.upstreamVersion;
    if (bannerSig && !bannerError) state.bannersVersion = bannerSig;
    state.skippedUpstream = undefined;
    state.gameVersion = gameVersion || state.gameVersion;
    state.lastSyncAt = new Date();
    state.lastStatus = hasChanges ? "applied" : "up-to-date";
    state.lastError = undefined;
    if (hasChanges) state.unseen = true;
    await state.save();

    return { ...report, status: hasChanges ? "applied" : "up-to-date", durationMs: Date.now() - started };
  } catch (err) {
    state.lastStatus = "failed";
    state.lastError = err.message;
    state.unseen = true;
    await state.save().catch(() => {});
    if (!dryRun) {
      await Changelog.create({
        game, status: "failed", upstreamBefore: state.upstreamVersion, problems: [err.message],
        durationMs: Date.now() - started,
      }).catch(() => {});
      await trimChangelog(game).catch(() => {});
    }
    throw err;
  } finally {
    running = null;
  }
}

/** Synchronise every game that has an adapter, one after the other. */
async function runAll(options = {}) {
  const results = [];
  for (const game of Object.keys(ADAPTERS)) {
    try {
      results.push(await runSync(game, options));
    } catch (err) {
      results.push({ game, status: "failed", errors: [err.message] });
    }
  }
  return results;
}

/** Undo the last applied sync of a game using its automatic backup. */
async function rollback(game) {
  if (running) throw Object.assign(new Error(`A sync is running (${running})`), { statusCode: 409 });
  const last = await Changelog.findOne({ game, status: "applied", backup: { $ne: null } }).sort({ createdAt: -1 });
  if (!last) throw Object.assign(new Error(`No applied sync to roll back for ${game}`), { statusCode: 404 });

  running = game;
  try {
    await restoreGame(game, last.backup);
    last.status = "rolled-back";
    await last.save();
    // Remember the undone version so the next automatic sync does not re-apply it
    await SyncState.updateOne(
      { game },
      {
        $set: {
          upstreamVersion: last.upstreamBefore,
          skippedUpstream: last.upstreamAfter,
          lastStatus: "up-to-date",
          lastError: null,
        },
      }
    );
    // The backup restored the enhancement tables as they were: re-read the YAML files
    await require("../enhancements/loader").loadEnhancements().catch(() => {});
    return { game, status: "rolled-back", backup: last.backup, restoredTo: last.upstreamBefore, skipped: last.upstreamAfter };
  } finally {
    running = null;
  }
}

module.exports = { runSync, runAll, rollback, isRunning, ADAPTERS, _test: { canon, same, computeDiff, validate, collapseDuplicates, hasImage } };
