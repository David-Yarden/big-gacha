/**
 * Honkai: Star Rail Data Seeder
 *
 * Pulls all data from Mar-7th/StarRailRes (GitHub) and imports it into MongoDB.
 * Run:       npm run seed:hsr
 * Overwrite: npm run seed:hsr:force
 *
 * Seed order (dependency-safe):
 *   1. Materials  — no dependencies
 *   2. Characters — uses promotions data
 *   3. Traces     — uses skills + skill_trees data; keyed by character name
 *   4. Eidolons   — uses ranks data; keyed by character name
 *   5. Light Cones — uses LC promotions + ranks data
 *   6. Relics     — uses relic_sets + relics data
 */

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const sink = require("../sync/sink");
delete require.cache[require.resolve("./signatures")]; // edits to the table apply on the next sync
const { signatureOf, signatureWeapon } = require("./signatures");
const {
  Character,
  Material,
  LightCone,
  Relic,
  Trace,
  Eidolon,
  Reference,
} = require("../models");
const {
  fetchHsr,
  cdnUrl,
  resolvePath,
  resolveElement,
  computeStats,
} = require("./hsrData");

const GAME = "hsr";
const forceOverwrite = process.argv.includes("--force");

// ─── Character release version lookup ─────────────────────────────────────────
// FROZEN history (characters released before the automatic sync existed).
// Do not extend it: a new character automatically gets the game version announced by
// the source the day it first appears (sync engine), and known versions are never erased.
const HSR_VERSION_MAP = {
  // 1.0 — Global Launch (April 26, 2023)
  "March 7th":   "1.0", // 1001 Preservation
  "March 7th (The Hunt)": "2.4", // 1224 — renamed by disambiguateNames()
  "Dan Heng":    "1.0",
  "Himeko":      "1.0",
  "Welt":        "1.0",
  "Arlan":       "1.0",
  "Asta":        "1.0",
  "Herta":       "1.0",
  "Bronya":      "1.0",
  "Seele":       "1.0",
  "Serval":      "1.0",
  "Gepard":      "1.0",
  "Natasha":     "1.0",
  "Pela":        "1.0",
  "Clara":       "1.0",
  "Sampo":       "1.0",
  "Hook":        "1.0",
  "Qingque":     "1.0",
  "Tingyun":     "1.0",
  "Sushang":     "1.0",
  "Yanqing":     "1.0",
  "Bailu":       "1.0",
  "Jing Yuan":   "1.0", // 1.0 Phase 2 (May 17, 2023)
  "Trailblazer": "1.0",

  // 1.1 (June 7, 2023)
  "Silver Wolf": "1.1",
  "Luocha":      "1.1",
  "Yukong":      "1.1",

  // 1.2 (July 19, 2023)
  "Blade":       "1.2",
  "Kafka":       "1.2",
  "Luka":        "1.2",

  // 1.3 (August 30, 2023)
  "Dan Heng \u2022 Imbibitor Lunae": "1.3",
  "Fu Xuan":     "1.3",
  "Lynx":        "1.3",
  "Guinaifen":   "1.3",

  // 1.4 (October 11, 2023)
  "Jingliu":        "1.4",
  "Topaz & Numby":  "1.4",
  "Xueyi":          "1.4",
  "Hanya":          "1.4",

  // 1.5 (November 15, 2023)
  "Argenti":     "1.5",
  "Huohuo":      "1.5",

  // 1.6 (December 27, 2023)
  "Dr. Ratio":   "1.6",
  "Ruan Mei":    "1.6",
  "Misha":       "1.6",

  // 2.0 (February 6, 2024)
  "Black Swan":  "2.0",
  "Sparkle":     "2.0",
  "Gallagher":   "2.0",

  // 2.1 (March 20, 2024)
  "Acheron":     "2.1",
  "Aventurine":  "2.1",

  // 2.2 (May 1, 2024)
  "Robin":       "2.2",
  "Boothill":    "2.2",

  // 2.3 (June 19, 2024)
  "Firefly":     "2.3",
  "Jade":        "2.3",

  // 2.4 (July 31, 2024)
  "Yunli":       "2.4",
  "Moze":        "2.4",

  // 2.5 (September 11, 2024)
  "Feixiao":     "2.5",
  "Lingsha":     "2.5",
  "Jiaoqiu":     "2.5",

  // 2.6 (October 16, 2024)
  "Rappa":       "2.6",

  // 2.7 (November 27, 2024)
  "Sunday":      "2.7",
  "Fugue":       "2.7",

  // 3.0 (January 15, 2025)
  "The Herta":   "3.0",
  "Aglaea":      "3.0",
  "Tribbie":     "3.0",

  // 3.1 (February 2025)
  "Mydei":       "3.1",
  "Castorice":   "3.1",
  "Cipher":      "3.1",

  // 3.2 (March 2025)
  "Anaxa":       "3.2",
  "Hyacine":     "3.2",

  // 3.3 (April 2025)
  "Phainon":     "3.3",

  // 3.4 (July 11, 2025) — Fate/stay night collab
  "Saber":       "3.4",
  "Archer":      "3.4",

  // 3.5 (August 13, 2025)
  "Hysilens":    "3.5",
  "Cerydra":     "3.5",

  // 3.6 (September 2025)
  "Evernight":            "3.6",
  "Dan Heng \u2022 Permansor Terrae": "3.6",

  // 3.7
  "Cyrene":      "3.7",

  // 3.8
  "The Dahlia":  "3.8",

  // 4.0 (February 12, 2026)
  "Sparxie":     "4.0",
  "Yao Guang":   "4.0",

  // 4.1 (March 25, 2026)
  "Ashveil":     "4.1",

  // 4.2 (April 22, 2026) — also the Elation Trailblazer
  "Silver Wolf LV.999": "4.2",
  "Evanescia":   "4.2",

  // 4.3 (June 3, 2026)
  "Mortenax Blade": "4.3",

  // 4.4 (July 15, 2026) — Fate/stay night collab part 2 from July 24
  "Himeko \u2022 Nova": "4.4",
  "Rin Tohsaka": "4.4",
  "Gilgamesh":   "4.4",

  // 4.5 (August 26, 2026)
  "Robin \u2022 Summeretto":    "4.5",
  "Aventurine \u2022 Waveflair": "4.5",

  // 4.6 (September 27, 2026)
  "Pearl":       "4.6",
};

// ─── Relic set release versions ───────────────────────────────────────────────
// FROZEN history, by set id: first version of Mar-7th/StarRailRes relic_sets.json
// containing the set (100s = Cavern, 300s = Planar). New sets get null until added here.
const HSR_RELIC_VERSION_MAP = {
  101: "1.0", 102: "1.0", 103: "1.0", 104: "1.0", 105: "1.0", 106: "1.0", 107: "1.0", 108: "1.0", 109: "1.0", 110: "1.0", 111: "1.0", 112: "1.0", 301: "1.0", 302: "1.0", 303: "1.0", 304: "1.0", 305: "1.0", 306: "1.0", 307: "1.0", 308: "1.0",
  113: "1.2", 114: "1.2", 309: "1.2", 310: "1.2",
  115: "1.5", 116: "1.5", 311: "1.5", 312: "1.5",
  117: "2.0", 118: "2.0",
  313: "2.1", 314: "2.1",
  119: "2.3", 120: "2.3", 315: "2.3", 316: "2.3",
  317: "2.5", 318: "2.5",
  121: "2.6", 122: "2.6",
  123: "3.0", 124: "3.0",
  319: "3.1", 320: "3.1",
  125: "3.3", 126: "3.3",
  321: "3.4", 322: "3.4",
  127: "3.6", 128: "3.6",
  323: "3.7", 324: "3.7",
  129: "4.0", 130: "4.0",
  325: "4.1", 326: "4.1",
  131: "4.3", 132: "4.3",
  327: "4.4", 328: "4.4",
  133: "4.6", 134: "4.6",
};

// ─── Light cone release versions ──────────────────────────────────────────────
// FROZEN history, by light cone id: the version whose data first contained it, read
// from the history of Mar-7th/StarRailRes (index_new/en/light_cones.json, one commit
// per game version) and spot-checked against patch notes (4.2: Welcome to Cosmic City…).
// New light cones get the version announced by the source when they first appear.
const HSR_LC_VERSION_MAP = {
  // 1.0
  20000: "1.0", 20001: "1.0", 20002: "1.0", 20003: "1.0", 20004: "1.0", 20005: "1.0", 20006: "1.0", 20007: "1.0",
  20008: "1.0", 20009: "1.0", 20010: "1.0", 20011: "1.0", 20012: "1.0", 20013: "1.0", 20014: "1.0", 20015: "1.0",
  20016: "1.0", 20017: "1.0", 20018: "1.0", 20019: "1.0", 20020: "1.0", 21000: "1.0", 21001: "1.0", 21002: "1.0",
  21003: "1.0", 21004: "1.0", 21005: "1.0", 21006: "1.0", 21007: "1.0", 21008: "1.0", 21009: "1.0", 21010: "1.0",
  21011: "1.0", 21012: "1.0", 21013: "1.0", 21014: "1.0", 21015: "1.0", 21016: "1.0", 21017: "1.0", 21018: "1.0",
  21019: "1.0", 21020: "1.0", 21021: "1.0", 21022: "1.0", 21023: "1.0", 21024: "1.0", 21025: "1.0", 21026: "1.0",
  21027: "1.0", 21028: "1.0", 21029: "1.0", 21030: "1.0", 21031: "1.0", 21032: "1.0", 21033: "1.0", 21034: "1.0",
  23000: "1.0", 23001: "1.0", 23002: "1.0", 23003: "1.0", 23004: "1.0", 23005: "1.0", 23010: "1.0", 23012: "1.0",
  23013: "1.0", 24000: "1.0", 24001: "1.0", 24002: "1.0", 29000: "1.0",
  // 1.1
  22000: "1.1", 23007: "1.1", 23008: "1.1",
  // 1.2
  23006: "1.2", 23009: "1.2",
  // 1.3
  23011: "1.3", 23015: "1.3", 24003: "1.3",
  // 1.4
  23014: "1.4", 23016: "1.4",
  // 1.5
  22001: "1.5", 23017: "1.5", 23018: "1.5",
  // 1.6
  23019: "1.6", 23020: "1.6",
  // 2.0
  21035: "2.0", 21036: "2.0", 21037: "2.0", 21038: "2.0", 21039: "2.0", 21040: "2.0", 21041: "2.0", 21042: "2.0",
  23021: "2.0", 23022: "2.0",
  // 2.1
  21043: "2.1", 23023: "2.1", 23024: "2.1",
  // 2.2
  21044: "2.2", 22002: "2.2", 23026: "2.2", 23027: "2.2",
  // 2.3
  21045: "2.3", 23025: "2.3", 23028: "2.3", 24004: "2.3",
  // 2.4
  21046: "2.4", 23029: "2.4", 23030: "2.4",
  // 2.5
  21047: "2.5", 23031: "2.5", 23032: "2.5",
  // 2.6
  21048: "2.6", 22003: "2.6", 23033: "2.6",
  // 2.7
  23034: "2.7", 23035: "2.7",
  // 3.0
  20021: "3.0", 20022: "3.0", 21050: "3.0", 21051: "3.0", 21052: "3.0", 23036: "3.0", 23037: "3.0",
  // 3.1
  23038: "3.1", 23039: "3.1", 24005: "3.1",
  // 3.2
  22004: "3.2", 23040: "3.2", 23041: "3.2",
  // 3.3
  23042: "3.3", 23043: "3.3",
  // 3.4
  21053: "3.4", 21054: "3.4", 21055: "3.4", 21056: "3.4", 21057: "3.4", 21058: "3.4", 21060: "3.4", 21061: "3.4",
  21062: "3.4", 23044: "3.4", 23045: "3.4", 23046: "3.4",
  // 3.5
  22005: "3.5", 23047: "3.5", 23048: "3.5",
  // 3.6
  23049: "3.6", 23051: "3.6",
  // 3.7
  22006: "3.7", 23052: "3.7",
  // 3.8
  23050: "3.8",
  // 4.0
  20023: "4.0", 20024: "4.0", 21064: "4.0", 21065: "4.0", 23053: "4.0", 23054: "4.0",
  // 4.1
  23056: "4.1", 24006: "4.1",
  // 4.2
  22007: "4.2", 23057: "4.2", 23058: "4.2",
  // 4.3
  23059: "4.3",
  // 4.4
  23060: "4.4", 23061: "4.4", 23062: "4.4",
  // 4.5
  21066: "4.5", 22008: "4.5", 23063: "4.5", 23064: "4.5",
  // 4.6
  23055: "4.6",
};

// Trailblazer character IDs — paired boy/girl per path.
// We merge each pair into a single document (use the girl variant as canonical,
// boy as a display-name alias; both share the same skills and promotions).
// Grouped by path element so they map to Genshin's isTraveler / elementVariants pattern.
// Default grouping, replaced at run time by detectTrailblazerGroups() so that every
// new Trailblazer path (e.g. Elation in 4.x) is picked up without code changes.
let TRAILBLAZER_GROUPS = [
  { element: "Physical", path: "Destruction", ids: ["8001", "8002"] },
  { element: "Fire",     path: "Preservation", ids: ["8003", "8004"] },
  { element: "Imaginary",path: "Harmony",      ids: ["8005", "8006"] },
  { element: "Ice",      path: "Remembrance",  ids: ["8007", "8008"] },
];
let TRAILBLAZER_IDS = new Set(TRAILBLAZER_GROUPS.flatMap((g) => g.ids));

/**
 * Some characters share a name (March 7th: Preservation 1001 and The Hunt 1224).
 * The first ID keeps the plain name, later ones get their path appended, so each
 * one is its own document instead of overwriting the other.
 */
function disambiguateNames(characters) {
  const seen = new Set();
  for (const id of Object.keys(characters).sort((a, b) => Number(a) - Number(b))) {
    const c = characters[id];
    if (!c || TRAILBLAZER_IDS.has(id)) continue;
    if (seen.has(c.name)) c.name = `${c.name} (${resolvePath(c.path)})`;
    seen.add(c.name);
  }
}

/**
 * Trailblazer entries are the player characters: name "{NICKNAME}" / tag "player…".
 * Group the boy/girl pair of each path; the order follows the game IDs.
 */
function detectTrailblazerGroups(characters) {
  const players = Object.entries(characters)
    .filter(([, c]) => c?.name === "{NICKNAME}" || /^player/i.test(c?.tag ?? ""))
    .sort(([a], [b]) => Number(a) - Number(b));
  if (!players.length) return;
  const byPath = new Map();
  for (const [id, c] of players) {
    const key = c.path;
    if (!byPath.has(key)) byPath.set(key, { element: resolveElement(c.element), path: resolvePath(c.path), ids: [] });
    byPath.get(key).ids.push(id);
  }
  TRAILBLAZER_GROUPS = [...byPath.values()];
  TRAILBLAZER_IDS = new Set(TRAILBLAZER_GROUPS.flatMap((g) => g.ids));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsert(Model, filter, data) {
  return sink.upsert(Model, filter, data);
}

/**
 * Build the ascension cost arrays (ascend1…ascend6) from a promotions.materials array.
 * materials[i] is the cost of the (i+1)-th ascension (materials[6] is the empty max phase).
 * Each entry is an array of {id, num} — we resolve names and icon URLs from the items lookup.
 */
function buildAscensionCosts(materialsArr, items) {
  const costs = {};
  // materialsArr[0..5] = cost to enter phases 1–6 (e.g. March 7th: 3,200 Credits + 4 Thief's Instinct first)
  for (let phase = 1; phase <= 6; phase++) {
    const phaseItems = materialsArr?.[phase - 1] ?? [];
    costs[`ascend${phase}`] = phaseItems.map((m) => ({
      id: Number(m.id),
      name: items[m.id]?.name ?? `Item ${m.id}`,
      count: m.num,
      icon: cdnUrl(items[m.id]?.icon) ?? undefined,
    }));
  }
  return costs;
}

/**
 * Character Enhancement: the game data gives an enhanced character a second skill tree whose node
 * ids are "1" + the original ids (Kafka 1005: 1005001… and 11005001…). Splits the tree ids.
 */
function splitEnhanced(charId, nodeIds) {
  const isEnhanced = (n) => String(n).length === String(charId).length + 4 && String(n).startsWith(`1${charId}`);
  return { original: nodeIds.filter((n) => !isEnhanced(n)), enhanced: nodeIds.filter(isEnhanced) };
}

/** One-time unlock cost of a trace node (major trace or stat bonus). */
function nodeCost(node, items) {
  return (node?.levels?.[0]?.materials ?? []).map((m) => ({
    id: Number(m.id),
    name: items[m.id]?.name ?? `Item ${m.id}`,
    count: m.num,
    icon: cdnUrl(items[m.id]?.icon) ?? undefined,
  }));
}

/**
 * Build trace level costs for a single skill from its skill_tree node.
 * node.levels[0] = level 1 (free, no cost)
 * node.levels[1] = cost to reach level 2, etc.
 */
function buildSkillCosts(node, items) {
  const costs = {};
  const levels = node?.levels ?? [];
  // Start at index 1 (level 2) since level 1 is free
  for (let i = 1; i < levels.length; i++) {
    const levelMats = levels[i]?.materials ?? [];
    costs[`lvl${i + 1}`] = levelMats.map((m) => ({
      id: Number(m.id),
      name: items[m.id]?.name ?? `Item ${m.id}`,
      count: m.num,
      icon: cdnUrl(items[m.id]?.icon) ?? undefined,
    }));
  }
  return costs;
}

/**
 * Parse a skill description that uses HSR's #1[i]% param syntax.
 * Returns { desc, params } where params is a flat array per level (same as Genshin labels).
 * We store the raw desc and the params matrix so the frontend can render it.
 */
function parseSkillDesc(skill) {
  if (!skill) return null;
  return {
    name: skill.name,
    maxLevel: skill.max_level,
    desc: skill.desc,           // raw string with #1[i]% placeholders
    params: skill.params ?? [], // params[levelIndex] = [val0, val1, ...]
    icon: cdnUrl(skill.icon),
  };
}

// ─── Seed Materials ───────────────────────────────────────────────────────────

async function seedMaterials(items) {
  const entries = Object.values(items);
  console.log(`  Found ${entries.length} items`);

  // Only seed meaningful game materials (skip Virtual currency like Stellar Jade,
  // and entries with no useful category data)
  const meaningful = entries.filter(
    (it) => it.type !== "Virtual" && it.name && it.rarity
  );
  console.log(`  Seeding ${meaningful.length} materials (skipping Virtual currency)`);

  let count = 0;
  for (const item of meaningful) {
    await upsert(Material, { game: GAME, name: item.name }, {
      game: GAME,
      sourceId: Number(item.id),
      name: item.name,
      description: item.desc ?? "",
      category: item.type,
      materialType: item.sub_type ?? item.type,
      rarity: Number(item.rarity) || 1,
      source: item.come_from ?? [],
      images: { icon: cdnUrl(item.icon) },
    });
    count++;
  }
  console.log(`  ✓ Seeded ${count} materials`);
}

// ─── Seed Characters ──────────────────────────────────────────────────────────

// ─── Outfits ──────────────────────────────────────────────────────────────────
// Few and rarely added: read from the game data dump (DimbreathBot/TurnBasedGameData).
// Their names live in the 58 MB TextMap, so the few texts needed are cached on disk
// per TextMap commit. Text hashes are 64-bit: read from the raw JSON, never parsed as numbers.
const HSR_DUMP = "DimbreathBot/TurnBasedGameData";

async function hsrOutfits() {
  const { tryFetch } = require("../sync/http");
  const { githubLastCommitFor } = require("../sync/upstream");
  const fs = require("fs");
  const path = require("path");
  const raw = (f) => `https://raw.githubusercontent.com/${HSR_DUMP}/master/${f}`;
  const items = await tryFetch(raw("ExcelOutput/ItemConfigAvatarSkin.json"), { as: "text", timeout: 60_000 });
  const skins = await tryFetch(raw("ExcelOutput/AvatarSkin.json"), { as: "text", timeout: 60_000 });
  if (!items || !skins) return new Map();
  const owner = new Map([...skins.matchAll(/"ID":\s*(\d+),\s*"AvatarID":\s*(\d+)/g)].map((m) => [m[1], m[2]]));
  // "Normal" outfits change the character; "Stellar" ones only restyle the weapon (Cyrene's bow)
  const kind = new Map([...skins.matchAll(/"ID":\s*(\d+),\s*"AvatarID":\s*\d+,\s*"Type":\s*"(\w+)"/g)].map((m) => [m[1], m[2]]));
  // Outfit story (the item text is only "Use to change …'s Outfit")
  const synopsis = new Map(
    [...skins.matchAll(/"ID":\s*(\d+),[^{}]*?"AvatarSkinSynopsis":\s*\{\s*"Hash":\s*(-?\d+)/g)].map((m) => [m[1], m[2]])
  );
  const entries = [...items.matchAll(/"ID":\s*(\d+)[\s\S]*?"ItemName":\s*\{\s*"Hash":\s*(-?\d+)\s*\}[\s\S]*?"ItemDesc":\s*\{\s*"Hash":\s*(-?\d+)\s*\}/g)]
    .map((m) => ({ id: m[1], name: m[2], desc: synopsis.get(m[1]) ?? m[3], avatar: owner.get(m[1]) }))
    .filter((e) => e.avatar);
  if (!entries.length) return new Map();

  // Texts (cached per TextMap commit)
  const lang = require("./hsrData").getLang();
  const TEXT_MAP = `TextMap/TextMap${lang.toUpperCase()}.json`;
  const sha = await githubLastCommitFor(HSR_DUMP, TEXT_MAP);
  const dir = path.join(__dirname, "..", "..", "cache");
  const prefix = `hsr-skin-text-${lang}-`;
  const file = sha ? path.join(dir, `${prefix}${sha.slice(0, 12)}.json`) : null;
  let texts = null;
  if (file && fs.existsSync(file)) {
    try {
      texts = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      texts = null;
    }
  }
  const wanted = entries.flatMap((e) => [e.name, e.desc]);
  if (!texts || wanted.some((h) => !(h in texts))) {
    const map = await tryFetch(raw(TEXT_MAP), { timeout: 300_000 });
    if (!map) return new Map();
    texts = Object.fromEntries(wanted.map((h) => [h, map[h] ?? null]));
    if (file) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        for (const f of fs.readdirSync(dir)) {
          if (f.startsWith(prefix) || /^hsr-skin-text-[0-9a-f]{12}\./.test(f)) fs.unlinkSync(path.join(dir, f));
        }
        fs.writeFileSync(file, JSON.stringify(texts));
      } catch {
        /* cache is optional */
      }
    }
  }
  const clean = (x) => (x ? String(x).replace(/<[^>]+>/g, "").replace(/\\n/g, "\n").trim() : undefined);
  const ENKA_HSR = "https://enka.network/ui/hsr/SpriteOutput";
  const byAvatar = new Map();
  for (const e of entries) {
    if (!texts[e.name]) continue;
    const name = clean(texts[e.name]);
    // Square outfit icon like the default one (the game's item icon, from the wiki); round icon otherwise
    const item = wikiItemIcon(name);
    const itemOk = await urlOk(item);
    const weaponOnly = kind.get(e.id) === "Stellar";
    if (weaponOnly && !itemOk) continue; // nothing to show
    (byAvatar.get(e.avatar) ?? byAvatar.set(e.avatar, []).get(e.avatar)).push({
      name,
      // The item text is only a usage note ("Use to change …'s outfit"): not shown
      desc: /^(Use to change|After obtaining)/i.test(clean(texts[e.desc]) || "") ? undefined : clean(texts[e.desc]),
      splash: weaponOnly ? item : `${ENKA_HSR}/AvatarDrawCard/AvatarSkin/${e.id}.png`,
      fit: weaponOnly ? "contain" : undefined,
      icon: itemOk ? item : `${ENKA_HSR}/AvatarRoundIcon/AvatarSkin/${e.id}.png`,
    });
  }
  return byAvatar;
}

/** HSR wiki file "Item <outfit name>.png" (fandom path: /images/<md5[0]>/<md5[0..1]>/<file>). */
function wikiItemIcon(name) {
  const file = `Item ${name}.png`.replace(/"/g, "").replace(/ /g, "_");
  const h = require("crypto").createHash("md5").update(file).digest("hex");
  return `https://static.wikia.nocookie.net/houkai-star-rail/images/${h[0]}/${h.slice(0, 2)}/${encodeURIComponent(file)}`;
}

async function urlOk(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Outfits of a character with its default look first (the page shows its usual splash). */
function withDefaultOutfit(outfits, icon) {
  if (!outfits?.length) return undefined;
  return [{ name: "Default", default: true, icon }, ...outfits];
}

// ─── Recommended build (the game's own: AvatarRelicRecommend) ───────────────────
let RELIC_SET_NAMES = new Map(); // relic set id → name (filled by fetchAll)

const HSR_PROP_NAMES = {
  HPDelta: "HP", AttackDelta: "ATK", DefenceDelta: "DEF",
  HPAddedRatio: "HP%", AttackAddedRatio: "ATK%", DefenceAddedRatio: "DEF%",
  SpeedDelta: "SPD", CriticalChanceBase: "CRIT Rate", CriticalDamageBase: "CRIT DMG",
  HealRatioBase: "Outgoing Healing Boost", StatusProbabilityBase: "Effect Hit Rate",
  StatusResistanceBase: "Effect RES", BreakDamageAddedRatioBase: "Break Effect",
  SPRatioBase: "Energy Regeneration Rate",
  PhysicalAddedRatio: "Physical DMG Boost", FireAddedRatio: "Fire DMG Boost", IceAddedRatio: "Ice DMG Boost",
  ThunderAddedRatio: "Lightning DMG Boost", WindAddedRatio: "Wind DMG Boost",
  QuantumAddedRatio: "Quantum DMG Boost", ImaginaryAddedRatio: "Imaginary DMG Boost",
};
/** "ElationDamageAddedRatioBase" → "Elation Damage Added Ratio" for a property this table does not know yet */
const hsrProp = (p) =>
  HSR_PROP_NAMES[p] ?? p.replace(/(Base|Delta)$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");

async function hsrBuilds() {
  const { tryFetch } = require("../sync/http");
  const rows = await tryFetch(`https://raw.githubusercontent.com/${HSR_DUMP}/master/ExcelOutput/AvatarRelicRecommend.json`, { timeout: 60_000 });
  const builds = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const names = (ids) => (ids || []).map((id) => RELIC_SET_NAMES.get(id)).filter(Boolean);
    const sets = [
      { label: "Cavern Relics (4-Piece)", names: names(r.Set4IDList) },
      { label: "Planar Ornaments", names: names(r.Set2IDList) },
    ].filter((g) => g.names.length);
    const SLOT = { BODY: "Body", FOOT: "Feet", OBJECT: "Planar Sphere", NECK: "Link Rope" };
    const bySlot = new Map();
    for (const p of r.PropertyList || []) {
      const slot = SLOT[p.RelicType] ?? p.RelicType;
      bySlot.set(slot, [...(bySlot.get(slot) || []), hsrProp(p.PropertyType)]);
    }
    // PropertyList holds one stat per slot; the PropertyListN arrays give every accepted one
    const extra = { Body: r.PropertyList3, Feet: r.PropertyList4, "Planar Sphere": r.PropertyList5, "Link Rope": r.PropertyList6 };
    for (const [slot, list] of Object.entries(extra)) {
      if (Array.isArray(list) && list.length) bySlot.set(slot, [...new Set(list.map(hsrProp))]);
    }
    const slots = ["Body", "Feet", "Planar Sphere", "Link Rope"]
      .filter((sl) => bySlot.has(sl))
      .map((slot) => ({ slot, stats: bySlot.get(slot) }));
    const substats = (r.SubAffixPropertyList || []).map(hsrProp);
    if (sets.length || slots.length) builds.set(String(r.AvatarID), { sets, slots, substats: substats.length ? substats : undefined });
  }
  return builds;
}

// ─── Level EXP curves (characters and light cones) ───────────────────────

/**
 * Cumulative EXP to reach each level and the EXP items, from the game tables:
 * ExpType (characters, per ExpGroup), EquipmentExpType (light cones, per ExpType),
 * AvatarExpItemConfig (no Credit cost) and EquipmentExpItemConfig (CoinCost per item).
 * Returns { avatar: Map(avatarId → levelExp), equipment: Map(lightConeId → levelExp) }.
 */
let LEVEL_CURVES = { avatar: new Map(), equipment: new Map() };
async function hsrLevelCurves(items) {
  const { tryFetch } = require("../sync/http");
  const get = (f) => tryFetch(`https://raw.githubusercontent.com/${HSR_DUMP}/master/ExcelOutput/${f}`, { timeout: 120_000 });
  const [expType, avatarItems, eqType, eqItems, avatars, equipments] = await Promise.all(
    ["ExpType.json", "AvatarExpItemConfig.json", "EquipmentExpType.json", "EquipmentExpItemConfig.json", "AvatarConfig.json", "EquipmentConfig.json"].map(get)
  );
  const out = { avatar: new Map(), equipment: new Map() };
  if (![expType, avatarItems, eqType, eqItems, avatars, equipments].every(Array.isArray)) {
    console.warn("  ⚠ HSR EXP tables unavailable: level EXP not counted");
    return out;
  }
  // rows: { Level, Exp } = EXP from Level to Level + 1
  const curves = (rows, key) => {
    const byType = new Map();
    for (const r of rows) {
      if (!byType.has(r[key])) byType.set(r[key], []);
      byType.get(r[key]).push(r);
    }
    const res = new Map();
    for (const [type, list] of byType) {
      const exp = [0, 0];
      for (const r of list.sort((a, b) => a.Level - b.Level)) exp[r.Level + 1] = (exp[r.Level] ?? 0) + (r.Exp ?? 0);
      res.set(type, Array.from(exp, (v) => v ?? 0));
    }
    return res;
  };
  const item = (id, exp, coin) => ({
    id, name: items[id]?.name ?? `Item ${id}`, exp, ...(coin ? { coin } : {}), icon: cdnUrl(items[id]?.icon) ?? undefined,
  });
  const credit = { id: 2, name: items[2]?.name ?? "Credit", icon: cdnUrl(items[2]?.icon) ?? undefined };
  const avatarList = avatarItems.map((x) => item(x.ItemID, x.Exp)).sort((a, b) => b.exp - a.exp);
  const eqList = eqItems.map((x) => item(x.ItemID, x.ExpProvide, x.CoinCost)).sort((a, b) => b.exp - a.exp);
  const avatarCurves = curves(expType, "TypeID");
  const eqCurves = curves(eqType, "ExpType");
  for (const a of avatars) {
    const exp = avatarCurves.get(a.ExpGroup);
    if (exp) out.avatar.set(String(a.AvatarID), { exp: exp.slice(0, 81), items: avatarList });
  }
  for (const e of equipments) {
    const exp = eqCurves.get(e.ExpType);
    if (exp) out.equipment.set(String(e.EquipmentID), { exp: exp.slice(0, 81), items: eqList, coin: credit });
  }
  return out;
}

async function seedCharacters(characters, promotions, items) {
  const outfits = await hsrOutfits().catch(() => new Map());
  const builds = await hsrBuilds().catch(() => new Map());
  if (builds.size) console.log(`  ✓ Recommended builds for ${builds.size} characters`);
  if (outfits.size) console.log(`  ✓ Outfits for ${outfits.size} characters`);
  const ids = Object.keys(characters).filter((id) => !TRAILBLAZER_IDS.has(id));
  console.log(`  Found ${ids.length} regular characters (+ Trailblazer variants handled separately)`);

  // Hover glossary per character (extra effects from sr.yatta.moe), fetched in parallel
  const { hsrGlossary, hsrProfile, mapLimit } = require("../sync/glossary");
  const lang = require("./hsrData").getLang();
  const glossaries = new Map();
  const profiles = new Map();
  await mapLimit(ids, 6, async (id) => {
    glossaries.set(id, await hsrGlossary([id], lang));
    profiles.set(id, await hsrProfile(id, lang));
  });
  const trailblazerGlossary = await hsrGlossary(TRAILBLAZER_GROUPS.map((g) => g.ids[0]), lang);
  console.log(`  ✓ Glossaries for ${[...glossaries.values()].filter(Boolean).length} characters`);

  let count = 0;
  for (const id of ids) {
    const char = characters[id];
    const promo = promotions[id];
    if (!char || !promo) continue;

    const stats = computeStats(promo.values, 80, ["hp", "atk", "def", "spd"]);

    await upsert(Character, { game: GAME, name: char.name }, {
      game: GAME,
      sourceId: Number(id),
      name: char.name,
      rarity: char.rarity,
      element: resolveElement(char.element),
      path: resolvePath(char.path),
      version: HSR_VERSION_MAP[char.name] ?? null,
      signatureWeapon: signatureWeapon(GAME, char.name),
      glossary: glossaries.get(id),
      ...(profiles.get(id) ?? {}),
      region: profiles.get(id)?.affiliation, // faction filter
      stats,
      costs: buildAscensionCosts(promo.materials, items),
      levelExp: LEVEL_CURVES.avatar.get(String(id)),
      skins: withDefaultOutfit(outfits.get(String(id)), cdnUrl(char.icon)),
      build: builds.get(String(id)),
      images: {
        icon:      cdnUrl(char.icon),
        preview:   cdnUrl(char.preview),
        portrait:  cdnUrl(char.portrait),
      },
    });
    count++;
  }

  // Trailblazer — one document per path variant, using isTraveler + elementVariants
  // Each group shares the same character name "Trailblazer"
  const elementVariants = {};
  for (const group of TRAILBLAZER_GROUPS) {
    const canonicalId = group.ids[0]; // boy variant as data source
    const char = characters[canonicalId];
    const promo = promotions[canonicalId];
    if (!char || !promo) continue;

    const stats = computeStats(promo.values, 80, ["hp", "atk", "def", "spd"]);
    elementVariants[group.element] = {
      path: group.path,
      stats,
      costs: buildAscensionCosts(promo.materials, items),
      images: {
        icon:    cdnUrl(char.icon),
        preview: cdnUrl(char.preview),
      },
    };
  }

  // Use the Physical/Destruction variant as the base document
  const baseGroup = TRAILBLAZER_GROUPS[0];
  const baseChar = characters[baseGroup.ids[0]];
  const basePromo = promotions[baseGroup.ids[0]];
  if (baseChar && basePromo) {
    const baseStats = computeStats(basePromo.values, 80, ["hp", "atk", "def", "spd"]);
    await upsert(Character, { game: GAME, name: "Trailblazer" }, {
      game: GAME,
      sourceId: Number(baseGroup.ids[0]),
      name: "Trailblazer",
      rarity: baseChar.rarity,
      element: resolveElement(baseChar.element),
      path: resolvePath(baseChar.path),
      version: "1.0",
      affiliation: "Astral Express",
      region: "Astral Express",
      stats: baseStats,
      costs: buildAscensionCosts(basePromo.materials, items),
      levelExp: LEVEL_CURVES.avatar.get(String(baseGroup.ids[0])),
      images: {
        icon:    cdnUrl(baseChar.icon),
        preview: cdnUrl(baseChar.preview),
      },
      isTraveler: true,
      availableElements: TRAILBLAZER_GROUPS.map((g) => g.element),
      elementVariants,
      glossary: trailblazerGlossary,
      ...((await hsrProfile(TRAILBLAZER_GROUPS[0].ids[0], lang)) ?? {}),
    });
    count++;
  }

  console.log(`  ✓ Seeded ${count} characters (incl. Trailblazer)`);
}

// ─── Seed Traces ──────────────────────────────────────────────────────────────

async function seedTraces(characters, skills, skillTrees, items) {
  const ids = Object.keys(characters).filter((id) => !TRAILBLAZER_IDS.has(id));
  console.log(`  Seeding traces for ${ids.length} characters`);

  // Skill type_text → our field name (single skills)
  const SKILL_KEY_MAP = {
    "Basic ATK":     "basicAtk",
    "Skill":         "skill",
    "Ultimate":      "ultimate",
    "Talent":        "talent",
    "Technique":     "technique",
    "Elation Skill": "elation",
  };

  // Memosprite skill types — these are grouped by node (multiple skills share one upgrade cost)
  const MEMOSPRITE_TYPES = new Set(["Memosprite Skill", "Memosprite Talent"]);

  /**
   * The kit of one skill tree: skills (with their costs and icons), memosprite groups, major
   * traces and stat bonus nodes.
   */
  function treeKit(nodeIds) {
    const skillNodes          = {}; // skillKey → tree node (single skills)
    const statBonuses         = [];
    const majorTraces         = []; // named passive abilities (A2/A4/A6)
    const skillData           = {}; // skillKey → parsed skill (single skills)
    const images              = {};
    const memospriteGroupNodes = []; // { node, groupSkills[] } — one per memo node
    const seenSkillIds        = new Set(); // deduplicate single-skill nodes

    for (const nodeId of nodeIds) {
      const node = skillTrees[nodeId];
      if (!node) continue;

      if (node.level_up_skills?.length > 0) {
        const firstSkillId = node.level_up_skills[0].id;
        const firstSkill   = skills[firstSkillId];

        if (firstSkill && MEMOSPRITE_TYPES.has(firstSkill.type_text)) {
          // Memosprite node — collect ALL unique skills in this node (they level together)
          const groupSkills = [];
          const seenInNode  = new Set();
          for (const lu of node.level_up_skills) {
            if (seenInNode.has(lu.id)) continue;
            seenInNode.add(lu.id);
            const s = skills[lu.id];
            if (s) groupSkills.push(parseSkillDesc(s));
          }
          memospriteGroupNodes.push({ node, skills: groupSkills });
        } else {
          // Single skill node
          if (seenSkillIds.has(firstSkillId)) continue;
          seenSkillIds.add(firstSkillId);
          if (!firstSkill) continue;

          const key = SKILL_KEY_MAP[firstSkill.type_text];
          if (key) {
            skillNodes[key] = node;
            skillData[key]  = parseSkillDesc(firstSkill);
            images[key]     = cdnUrl(firstSkill.icon);
          }
        }
      } else {
        const props = node.levels?.[0]?.properties ?? [];
        const unlockPhase = node.levels?.[0]?.promotion ?? 0;
        if (node.desc) {
          // Major trace — named passive ability (A2 / A4 / A6)
          majorTraces.push({
            name:        node.name,
            desc:        node.desc,
            params:      node.params ?? [],
            icon:        cdnUrl(node.icon),
            unlockPhase,
            cost:        nodeCost(node, items),
          });
        } else {
          // Minor stat bonus node
          // The node's unlock cost goes on its first stat (dedupe-safe: costs are not compared)
          props.forEach((prop, i) => {
            statBonuses.push({ stat: prop.type, value: prop.value, unlockPhase, ...(i === 0 ? { cost: nodeCost(node, items) } : {}) });
          });
        }
      }
    }

    // Build per-skill costs for single skills
    const costs = {};
    for (const [key, node] of Object.entries(skillNodes)) {
      costs[key] = buildSkillCosts(node, items);
    }

    // Build memospriteGroups — each entry has skills[] + costs embedded
    const memospriteGroups = memospriteGroupNodes.map(({ node, skills: groupSkills }) => ({
      skills: groupSkills,
      costs:  buildSkillCosts(node, items),
    }));

    return {
      basicAtk:  skillData.basicAtk  ?? null,
      skill:     skillData.skill     ?? null,
      ultimate:  skillData.ultimate  ?? null,
      talent:    skillData.talent    ?? null,
      technique: skillData.technique ?? null,
      elation:   skillData.elation   ?? null,
      memospriteGroups: memospriteGroups.length > 0 ? memospriteGroups : null,
      majorTraces,
      statBonuses,
      costs,
      images,
    };
  }

  let count = 0;
  for (const id of ids) {
    const char = characters[id];
    if (!char) continue;

    // Enhanced characters (Character Enhancement) have a second tree in the game data, its node ids
    // being "1" + the usual id (1005001 → 11005001): the original kit stays the document, the
    // enhanced one goes in `enhanced`
    const { original: treeIds, enhanced: enhancedIds } = splitEnhanced(id, char.skill_trees ?? []);

    await upsert(Trace, { game: GAME, name: char.name }, {
      game: GAME,
      name: char.name,
      ...treeKit(treeIds),
      enhanced: enhancedIds.length ? treeKit(enhancedIds) : null,
    });
    count++;
  }

  // Trailblazer traces — one doc with elementVariants
  const trailblazerVariants = {};
  for (const group of TRAILBLAZER_GROUPS) {
    const char = characters[group.ids[0]];
    if (!char) continue;

    const variantSkillData        = {};
    const variantImages           = {};
    const variantCosts            = {};
    const variantStatBonus        = [];
    const variantMajorTraces      = [];
    const variantSkillNodes       = {};
    const variantMemoGroupNodes   = []; // { node, skills[] }
    const variantSeenSkillIds     = new Set();

    for (const nodeId of char.skill_trees ?? []) {
      const node = skillTrees[nodeId];
      if (!node) continue;

      if (node.level_up_skills?.length > 0) {
        const firstSkillId = node.level_up_skills[0].id;
        const firstSkill   = skills[firstSkillId];

        if (firstSkill && MEMOSPRITE_TYPES.has(firstSkill.type_text)) {
          const groupSkills = [];
          const seenInNode  = new Set();
          for (const lu of node.level_up_skills) {
            if (seenInNode.has(lu.id)) continue;
            seenInNode.add(lu.id);
            const s = skills[lu.id];
            if (s) groupSkills.push(parseSkillDesc(s));
          }
          variantMemoGroupNodes.push({ node, skills: groupSkills });
        } else {
          if (variantSeenSkillIds.has(firstSkillId)) continue;
          variantSeenSkillIds.add(firstSkillId);
          if (!firstSkill) continue;

          const key = SKILL_KEY_MAP[firstSkill.type_text];
          if (key) {
            variantSkillNodes[key] = node;
            variantSkillData[key]  = parseSkillDesc(firstSkill);
            variantImages[key]     = cdnUrl(firstSkill.icon);
          }
        }
      } else {
        const props = node.levels?.[0]?.properties ?? [];
        const unlockPhase = node.levels?.[0]?.promotion ?? 0;
        if (node.desc) {
          variantMajorTraces.push({
            name:        node.name,
            desc:        node.desc,
            params:      node.params ?? [],
            icon:        cdnUrl(node.icon),
            unlockPhase,
            cost:        nodeCost(node, items),
          });
        } else {
          props.forEach((prop, i) => {
            variantStatBonus.push({ stat: prop.type, value: prop.value, unlockPhase, ...(i === 0 ? { cost: nodeCost(node, items) } : {}) });
          });
        }
      }
    }

    for (const [key, node] of Object.entries(variantSkillNodes)) {
      variantCosts[key] = buildSkillCosts(node, items);
    }

    const variantMemoGroups = variantMemoGroupNodes.map(({ node, skills: groupSkills }) => ({
      skills: groupSkills,
      costs:  buildSkillCosts(node, items),
    }));

    trailblazerVariants[group.element] = {
      basicAtk:  variantSkillData.basicAtk  ?? null,
      skill:     variantSkillData.skill     ?? null,
      ultimate:  variantSkillData.ultimate  ?? null,
      talent:    variantSkillData.talent    ?? null,
      technique: variantSkillData.technique ?? null,
      elation:   variantSkillData.elation   ?? null,
      memospriteGroups: variantMemoGroups.length > 0 ? variantMemoGroups : null,
      majorTraces: variantMajorTraces,
      statBonuses: variantStatBonus,
      costs: variantCosts,
      images: variantImages,
    };
  }

  await upsert(Trace, { game: GAME, name: "Trailblazer" }, {
    game: GAME,
    name: "Trailblazer",
    isTraveler: true,
    elementVariants: trailblazerVariants,
  });
  count++;

  console.log(`  ✓ Seeded ${count} trace sets`);
}

// ─── Seed Eidolons ────────────────────────────────────────────────────────────

async function seedEidolons(characters, ranks) {
  const ids = Object.keys(characters).filter((id) => !TRAILBLAZER_IDS.has(id));
  console.log(`  Seeding eidolons for ${ids.length} characters`);

  let count = 0;
  for (const id of ids) {
    const char = characters[id];
    if (!char) continue;

    // char.ranks is an array of 6 rank IDs e.g. ["100101","100102",…]
    const rankIds = char.ranks ?? [];
    const eidolons = {};
    const images   = {};

    for (const rankId of rankIds) {
      const rank = ranks[rankId];
      if (!rank) continue;
      const key = `e${rank.rank}`; // e1…e6
      eidolons[key] = {
        name: rank.name,
        description: rank.desc,
        levelUpSkills: rank.level_up_skills ?? [],
      };
      images[key] = cdnUrl(rank.icon);
    }

    // Character Enhancement: the enhanced eidolons are "1" + the rank id (100501 → 1100501);
    // only the ones whose text changed are kept
    const enhanced = {};
    for (const rankId of rankIds) {
      const rank = ranks[`1${rankId}`];
      const key = rank && `e${rank.rank}`;
      if (!rank || (rank.name === eidolons[key]?.name && rank.desc === eidolons[key]?.description)) continue;
      enhanced[key] = { name: rank.name, description: rank.desc, levelUpSkills: rank.level_up_skills ?? [] };
    }

    await upsert(Eidolon, { game: GAME, name: char.name }, {
      game: GAME,
      name: char.name,
      ...eidolons,
      images,
      enhanced: Object.keys(enhanced).length ? enhanced : null,
    });
    count++;
  }

  // Trailblazer eidolons — elementVariants per path
  const trailblazerVariants = {};
  for (const group of TRAILBLAZER_GROUPS) {
    const char = characters[group.ids[0]];
    if (!char) continue;

    const eidolons = {};
    const images   = {};
    for (const rankId of char.ranks ?? []) {
      const rank = ranks[rankId];
      if (!rank) continue;
      const key = `e${rank.rank}`;
      eidolons[key] = { name: rank.name, description: rank.desc, levelUpSkills: rank.level_up_skills ?? [] };
      images[key] = cdnUrl(rank.icon);
    }
    trailblazerVariants[group.element] = { ...eidolons, images };
  }

  await upsert(Eidolon, { game: GAME, name: "Trailblazer" }, {
    game: GAME,
    name: "Trailblazer",
    isTraveler: true,
    elementVariants: trailblazerVariants,
  });
  count++;

  console.log(`  ✓ Seeded ${count} eidolon sets`);
}

// ─── Seed Light Cones ─────────────────────────────────────────────────────────

async function seedLightCones(lightCones, lcPromotions, lcRanks, items) {
  const ids = Object.keys(lightCones);
  console.log(`  Found ${ids.length} light cones`);

  let count = 0;
  for (const id of ids) {
    const lc    = lightCones[id];
    const promo = lcPromotions[id];
    const rank  = lcRanks[id];
    if (!lc) continue;

    // Stats for all 80 levels (hp/atk/def only — no spd for light cones)
    const stats = promo
      ? computeStats(promo.values, 80, ["hp", "atk", "def"])
      : {};

    // Ascension costs
    const costs = promo
      ? buildAscensionCosts(promo.materials, items)
      : {};

    // Superimpositions S1–S5
    // rank.params is a 5-element array, each element is an array of numeric values.
    // Store raw numbers — the frontend uses the #N[format] specifier and a % look-ahead
    // to determine how to format each value (fraction × 100 for percentages, raw otherwise).
    const superimpositions = [];
    if (rank) {
      for (let s = 0; s < 5; s++) {
        const vals = rank.params?.[s] ?? [];
        superimpositions.push({
          description: rank.desc ?? "",
          values: vals,
        });
      }
    }

    await upsert(LightCone, { game: GAME, name: lc.name }, {
      game: GAME,
      sourceId: Number(id),
      name: lc.name,
      description: lc.desc ?? "",
      path: resolvePath(lc.path),
      rarity: lc.rarity,
      effectName: rank?.skill ?? null,
      version: HSR_LC_VERSION_MAP[id] ?? null,
      signatureOf: signatureOf(GAME, lc.name),
      effectTemplateRaw: rank?.desc ?? null,
      stats,
      superimpositions,
      costs,
      levelExp: LEVEL_CURVES.equipment.get(String(id)),
      images: {
        icon:    cdnUrl(lc.icon),
        preview: cdnUrl(lc.preview),
        portrait: cdnUrl(lc.portrait),
      },
    });
    count++;
  }
  console.log(`  ✓ Seeded ${count} light cones`);
}

// ─── Seed Relics ──────────────────────────────────────────────────────────────

/**
 * Reference table for the Relics page: 5★ main stats per slot (+0 → +15) and the values a
 * substat roll can give. From StarRailRes relic_main_affixes / relic_sub_affixes.
 */
async function seedRelicStats() {
  const [main, sub] = await Promise.all([fetchHsr("relic_main_affixes.json"), fetchHsr("relic_sub_affixes.json")]);
  const isPercent = (p) => p !== "SpeedDelta" && !/Delta$/.test(p);
  const fmt = (p, v) => (isPercent(p) ? `${(v * 100).toFixed(1)}%` : v >= 100 ? String(Math.round(v)) : v.toFixed(1));
  const SLOTS = ["Head", "Hands", "Body", "Feet", "Planar Sphere", "Link Rope"];
  const slots = SLOTS.map((slot, i) => {
    const group = main?.[`5${i + 1}`];
    return {
      slot,
      maxLevel: 15,
      mainStats: Object.values(group?.affixes || {}).map((a) => ({
        name: hsrProp(a.property),
        base: fmt(a.property, a.base),
        max: fmt(a.property, a.base + a.step * 15),
      })),
    };
  }).filter((s) => s.mainStats.length);
  const substats = Object.values(sub?.["5"]?.affixes || {}).map((a) => {
    const rolls = Array.from({ length: (a.step_num ?? 0) + 1 }, (_, k) => fmt(a.property, a.base + a.step * k));
    return { name: hsrProp(a.property), value: rolls.join(" / ") };
  });
  if (!slots.length) return;
  await upsert(Reference, { game: GAME, name: "Relic stats" }, {
    game: GAME,
    name: "Relic stats",
    data: { rank: "5★", slots, substats, substatNote: "Value of one roll (low / mid / high)" },
  });
}

async function seedRelics(relicSets, relicPieces) {
  await seedRelicStats().catch((e) => console.warn(`  ⚠ Relic stats: ${e.message}`));
  const setIds = Object.keys(relicSets);
  console.log(`  Found ${setIds.length} relic sets`);

  // Group individual pieces by set_id
  const piecesBySet = {};
  for (const piece of Object.values(relicPieces)) {
    const sid = piece.set_id;
    if (!piecesBySet[sid]) piecesBySet[sid] = [];
    piecesBySet[sid].push(piece);
  }

  // Map internal slot type → our field key
  const SLOT_MAP = {
    HEAD:   "head",
    HAND:   "hands",
    BODY:   "body",
    FOOT:   "feet",
    NECK:   "rope",    // Link Rope (Planar)
    OBJECT: "sphere",  // Planar Sphere
  };

  let count = 0;
  for (const setId of setIds) {
    const set = relicSets[setId];
    if (!set) continue;

    const desc = set.desc ?? [];

    // Planar = only 1 desc entry (2-piece bonus only); Cavern = 2 desc entries
    const isPlanar = desc.length < 2 || !desc[1];
    const type = isPlanar ? "planar" : "cavern";

    // Build pieces object
    const pieces = {};
    for (const piece of piecesBySet[setId] ?? []) {
      const key = SLOT_MAP[piece.type];
      if (!key) continue;
      pieces[key] = {
        name: piece.name,
        description: piece.desc ?? "",
        icon: piece.icon ? cdnUrl(piece.icon) : null,
      };
    }

    // Rarity — infer from piece rarities (take the max)
    const rarities = (piecesBySet[setId] ?? []).map((p) => p.rarity).filter(Boolean);
    const maxRarity = rarities.length ? Math.max(...rarities) : 5;

    await upsert(Relic, { game: GAME, name: set.name }, {
      game: GAME,
      sourceId: Number(setId),
      name: set.name,
      type,
      rarity: [maxRarity],
      twoPieceBonus:  desc[0] ?? null,
      fourPieceBonus: isPlanar ? null : (desc[1] ?? null),
      pieces,
      images: { icon: cdnUrl(set.icon) },
      version: HSR_RELIC_VERSION_MAP[setId] ?? null,
    });
    count++;
  }
  console.log(`  ✓ Seeded ${count} relic sets`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/** Download every StarRailRes file the seeders need. */
async function fetchAll() {
  console.log("Fetching data from Mar-7th/StarRailRes...");
  const [
    characters,
    promotions,
    ranks,
    skills,
    skillTrees,
    lightCones,
    lcPromotions,
    lcRanks,
    relicSets,
    relicPieces,
    items,
  ] = await Promise.all([
    fetchHsr("characters.json"),
    fetchHsr("character_promotions.json"),
    fetchHsr("character_ranks.json"),
    fetchHsr("character_skills.json"),
    fetchHsr("character_skill_trees.json"),
    fetchHsr("light_cones.json"),
    fetchHsr("light_cone_promotions.json"),
    fetchHsr("light_cone_ranks.json"),
    fetchHsr("relic_sets.json"),
    fetchHsr("relics.json"),
    fetchHsr("items.json"),
  ]);
  detectTrailblazerGroups(characters);
  RELIC_SET_NAMES = new Map(Object.entries(relicSets).map(([id, x]) => [Number(id), x.name]));
  disambiguateNames(characters);
  return {
    characters, promotions, ranks, skills, skillTrees,
    lightCones, lcPromotions, lcRanks, relicSets, relicPieces, items,
  };
}

/** Run every HSR seeder (used by the sync engine in recording mode). */
async function seedAll() {
  const d = await fetchAll();
  await seedMaterials(d.items);
  LEVEL_CURVES = await hsrLevelCurves(d.items);
  await seedCharacters(d.characters, d.promotions, d.items);
  await seedTraces(d.characters, d.skills, d.skillTrees, d.items);
  await seedEidolons(d.characters, d.ranks);
  await seedLightCones(d.lightCones, d.lcPromotions, d.lcRanks, d.items);
  await seedRelics(d.relicSets, d.relicPieces);
}

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   Honkai: Star Rail Database Seeder  ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Mode: ${forceOverwrite ? "FORCE OVERWRITE" : "UPSERT (safe)"}\n`);

  await connectDB();

  if (forceOverwrite) {
    const backup = await require("./backup").backupGame(GAME, "before-force-hsr");
    console.log(`💾 Sauvegarde avant effacement : backups/${backup}`);
    console.log("⚠  Dropping existing HSR data...");
    await Character.deleteMany({ game: GAME });
    await Material.deleteMany({ game: GAME });
    await LightCone.deleteMany({ game: GAME });
    await Relic.deleteMany({ game: GAME });
    await Trace.deleteMany({ game: GAME });
    await Eidolon.deleteMany({ game: GAME });
    console.log("  Done.\n");
  }

  const data = await fetchAll();
  console.log("  ✓ All data fetched\n");
  const {
    characters, promotions, ranks, skills, skillTrees,
    lightCones, lcPromotions, lcRanks, relicSets, relicPieces, items,
  } = data;

  const start = Date.now();

  console.log("[1/6] Seeding materials...");
  await seedMaterials(items);

  console.log("[2/6] Seeding characters...");
  await seedCharacters(characters, promotions, items);

  console.log("[3/6] Seeding traces...");
  await seedTraces(characters, skills, skillTrees, items);

  console.log("[4/6] Seeding eidolons...");
  await seedEidolons(characters, ranks);

  console.log("[5/6] Seeding light cones...");
  await seedLightCones(lightCones, lcPromotions, lcRanks, items);

  console.log("[6/6] Seeding relics...");
  await seedRelics(relicSets, relicPieces);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ HSR seed complete in ${elapsed}s`);

  await mongoose.connection.close();
  process.exit(0);
}

module.exports = { seedAll, GAME };

if (require.main === module) {
  main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
