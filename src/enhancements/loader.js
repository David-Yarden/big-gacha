/**
 * Loads kit enhancements from shared/games/<game>/enhancements/*.yaml into MongoDB.
 *
 * Each file is validated on its own: a file with an error is skipped (its previous
 * content stays in the database) and the error is reported in loadStatus().
 */
const fs = require("fs");
const path = require("path");
const { Enhancement, EnhancementType, Character } = require("../models");
const { GAME_IDS } = require("../../shared/games");

const ROOT = path.join(__dirname, "..", "..", "shared", "games");

const TARGETS = {
  genshin: {
    talent: ["combat1", "combat2", "combat3", "combatsp", "passive1", "passive2", "passive3", "passive4", "extra"],
    constellation: ["c1", "c2", "c3", "c4", "c5", "c6", "all"],
  },
  hsr: {
    trace: ["basicAtk", "skill", "ultimate", "talent", "technique", "extra"],
    eidolon: ["e1", "e2", "e3", "e4", "e5", "e6", "all"],
  },
  wuwa: {
    forte: ["basicAtk", "resonanceSkill", "resonanceLiberation", "forteCircuit", "introSkill", "outroSkill", "extra"],
    chain: ["s1", "s2", "s3", "s4", "s5", "s6", "all"],
  },
};
const KINDS = ["addition", "rework"];
const COLORS = ["violet", "amber", "sky", "emerald", "rose", "orange"];

let status = { loadedAt: null, files: [], errors: [] };

function loadStatus() {
  return status;
}

function yaml() {
  try {
    return require("js-yaml");
  } catch {
    throw new Error("Le paquet js-yaml n'est pas installé : lance `npm install js-yaml` à la racine du projet.");
  }
}

/** Parse and validate one file. Returns { type, entries, errors }. */
function parseFile(game, file, characterNames) {
  const errors = [];
  let doc;
  try {
    doc = yaml().load(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return { errors: [`YAML invalide : ${err.message.split("\n")[0]}`] };
  }
  if (!doc || typeof doc !== "object") return { errors: ["fichier vide"] };

  const id = String(doc.id || "").trim();
  if (!/^[a-z0-9-]+$/.test(id)) errors.push(`id "${doc.id}" invalide (minuscules, chiffres, tirets)`);
  if (!doc.name) errors.push("name manquant");
  if (!KINDS.includes(doc.kind)) errors.push(`kind doit valoir ${KINDS.join(" ou ")}`);
  if (doc.color && !COLORS.includes(doc.color)) errors.push(`color doit valoir ${COLORS.join(", ")}`);

  const entries = [];
  const targets = TARGETS[game] || {};
  (doc.entries || []).forEach((e, i) => {
    const where = `entrée ${i + 1}${e?.character ? ` (${e.character})` : ""}`;
    if (!e || typeof e !== "object") return errors.push(`${where} : format invalide`);
    if (!characterNames.has(e.character)) errors.push(`${where} : personnage "${e.character}" introuvable dans la base ${game}`);
    const [kind, slot] = String(e.target || "").split(".");
    if (!targets[kind]?.includes(slot)) {
      errors.push(`${where} : cible "${e.target}" invalide (ex. ${Object.entries(targets).map(([k, v]) => `${k}.${v[0]}`).join(", ")})`);
    }
    if (doc.kind === "addition" && !e.text) errors.push(`${where} : "text" manquant`);
    if (doc.kind === "rework" && !e.enhanced && !e.original) errors.push(`${where} : "original" ou "enhanced" manquant`);
    entries.push({
      game,
      type: id,
      character: e.character,
      target: e.target,
      text: e.text ? String(e.text).trim() : undefined,
      original: e.original,
      enhanced: e.enhanced,
      sources: Array.isArray(e.sources) ? e.sources : undefined,
      order: i,
    });
  });

  for (const c of doc.characters || []) {
    if (!characterNames.has(c)) errors.push(`characters : "${c}" introuvable dans la base ${game}`);
  }

  const type = {
    game,
    id,
    name: doc.name,
    version: doc.version != null ? String(doc.version) : undefined,
    kind: doc.kind,
    color: doc.color || "violet",
    condition: doc.condition,
    description: doc.description ? String(doc.description).trim() : undefined,
    verified: doc.verified !== false,
    characters: [...new Set([...(doc.characters || []), ...entries.map((e) => e.character)])],
    file: path.relative(path.join(ROOT, ".."), file).replace(/\\/g, "/"),
  };
  return { type, entries, errors };
}

/** (Re)load every game's enhancement files. */
async function loadEnhancements() {
  const report = { loadedAt: new Date().toISOString(), files: [], errors: [] };

  for (const game of GAME_IDS) {
    const dir = path.join(ROOT, game, "enhancements");
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/i.test(f)).sort();
    const characterNames = new Set(await Character.distinct("name", { game }));
    const validTypeIds = [];

    for (const f of files) {
      const file = path.join(dir, f);
      const { type, entries, errors } = parseFile(game, file, characterNames);
      const label = `${game}/${f}`;
      if (errors.length) {
        report.errors.push(...errors.map((e) => `${label} — ${e}`));
        report.files.push({ file: label, status: "rejected", errors: errors.length });
        if (type?.id) validTypeIds.push(type.id); // keep the previous version in the DB
        continue;
      }
      await EnhancementType.findOneAndUpdate({ game, id: type.id }, type, { upsert: true });
      await Enhancement.deleteMany({ game, type: type.id });
      if (entries.length) await Enhancement.insertMany(entries);
      validTypeIds.push(type.id);
      report.files.push({ file: label, status: "loaded", id: type.id, entries: entries.length });
    }

    // Mechanics whose file was deleted disappear
    await EnhancementType.deleteMany({ game, id: { $nin: validTypeIds } });
    await Enhancement.deleteMany({ game, type: { $nin: validTypeIds } });

    // Tag characters so the lists can filter on "has enhancement X"
    const types = await EnhancementType.find({ game }).lean();
    await Character.updateMany({ game }, { $unset: { enhancements: "" } });
    for (const t of types) {
      if (t.characters?.length) {
        await Character.updateMany({ game, name: { $in: t.characters } }, { $addToSet: { enhancements: t.id } });
      }
    }
  }

  status = report;
  if (report.errors.length) {
    console.warn(`⚠  Améliorations : ${report.errors.length} erreur(s)\n   ${report.errors.join("\n   ")}`);
  } else {
    console.log(`✨ Améliorations chargées : ${report.files.map((f) => `${f.file} (${f.entries})`).join(", ") || "aucune"}`);
  }
  return report;
}

module.exports = { loadEnhancements, loadStatus, TARGETS };
