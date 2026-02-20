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
const {
  Character,
  Material,
  LightCone,
  Relic,
  Trace,
  Eidolon,
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
// Source: official HSR patch notes + Fandom wiki / Game8 character history.
// Characters without an entry get version = null (sorts last).
const HSR_VERSION_MAP = {
  // 1.0 — Global Launch (April 26, 2023)
  "March 7th":   "1.0", // 1001 Preservation; 1224 Hunt (2.4) shares the same name
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
};

// Trailblazer character IDs — paired boy/girl per path.
// We merge each pair into a single document (use the girl variant as canonical,
// boy as a display-name alias; both share the same skills and promotions).
// Grouped by path element so they map to Genshin's isTraveler / elementVariants pattern.
const TRAILBLAZER_GROUPS = [
  { element: "Physical", path: "Destruction", ids: ["8001", "8002"] },
  { element: "Fire",     path: "Preservation", ids: ["8003", "8004"] },
  { element: "Imaginary",path: "Harmony",      ids: ["8005", "8006"] },
  { element: "Ice",      path: "Remembrance",  ids: ["8007", "8008"] },
];
const TRAILBLAZER_IDS = new Set(TRAILBLAZER_GROUPS.flatMap((g) => g.ids));

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsert(Model, filter, data) {
  return Model.findOneAndUpdate(filter, data, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
}

/**
 * Build the ascension cost arrays (ascend1…ascend6) from a promotions.materials array.
 * materials[0] is free (phase 0 base), so we start from index 1.
 * Each entry is an array of {id, num} — we resolve names from the items lookup.
 */
function buildAscensionCosts(materialsArr, items) {
  const costs = {};
  // materialsArr[0] = phase 0 (always free [])
  // materialsArr[1..6] = cost to enter phases 1–6
  for (let phase = 1; phase <= 6; phase++) {
    const phaseItems = materialsArr[phase] ?? [];
    costs[`ascend${phase}`] = phaseItems.map((m) => ({
      id: Number(m.id),
      name: items[m.id]?.name ?? `Item ${m.id}`,
      count: m.num,
    }));
  }
  return costs;
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

async function seedCharacters(characters, promotions) {
  const ids = Object.keys(characters).filter((id) => !TRAILBLAZER_IDS.has(id));
  console.log(`  Found ${ids.length} regular characters (+ Trailblazer variants handled separately)`);

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
      stats,
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
      stats: baseStats,
      images: {
        icon:    cdnUrl(baseChar.icon),
        preview: cdnUrl(baseChar.preview),
      },
      isTraveler: true,
      availableElements: TRAILBLAZER_GROUPS.map((g) => g.element),
      elementVariants,
    });
    count++;
  }

  console.log(`  ✓ Seeded ${count} characters (incl. Trailblazer)`);
}

// ─── Seed Traces ──────────────────────────────────────────────────────────────

async function seedTraces(characters, skills, skillTrees, items) {
  const ids = Object.keys(characters).filter((id) => !TRAILBLAZER_IDS.has(id));
  console.log(`  Seeding traces for ${ids.length} characters`);

  // Skill type_text → our field name
  const SKILL_KEY_MAP = {
    "Basic ATK":  "basicAtk",
    "Skill":      "skill",
    "Ultimate":   "ultimate",
    "Talent":     "talent",
    "Technique":  "technique",
  };

  let count = 0;
  for (const id of ids) {
    const char = characters[id];
    if (!char) continue;

    // Gather skill nodes (those with level_up_skills) and stat nodes
    const skillNodes   = {}; // skillKey → tree node (for cost extraction)
    const statBonuses  = [];
    const skillData    = {}; // skillKey → parsed skill
    const images       = {};

    for (const nodeId of char.skill_trees ?? []) {
      const node = skillTrees[nodeId];
      if (!node) continue;

      if (node.level_up_skills?.length > 0) {
        // Main skill-leveling node — find which skill it levels
        const skillId = node.level_up_skills[0].id;
        const skill = skills[skillId];
        if (!skill) continue;

        const key = SKILL_KEY_MAP[skill.type_text];
        if (!key) continue;

        skillNodes[key] = node;
        skillData[key]  = parseSkillDesc(skill);
        images[key]     = cdnUrl(skill.icon);
      } else {
        // Stat bonus node — extract the stat grant from levels[0].properties
        const props = node.levels?.[0]?.properties ?? [];
        const unlockPhase = node.levels?.[0]?.promotion ?? 0;
        for (const prop of props) {
          statBonuses.push({
            stat: prop.type,
            value: prop.value,
            unlockPhase,
          });
        }
      }
    }

    // Build per-skill costs
    const costs = {};
    for (const [key, node] of Object.entries(skillNodes)) {
      costs[key] = buildSkillCosts(node, items);
    }

    await upsert(Trace, { game: GAME, name: char.name }, {
      game: GAME,
      name: char.name,
      basicAtk:  skillData.basicAtk  ?? null,
      skill:     skillData.skill     ?? null,
      ultimate:  skillData.ultimate  ?? null,
      talent:    skillData.talent    ?? null,
      technique: skillData.technique ?? null,
      statBonuses,
      costs,
      images,
    });
    count++;
  }

  // Trailblazer traces — one doc with elementVariants
  const trailblazerVariants = {};
  for (const group of TRAILBLAZER_GROUPS) {
    const char = characters[group.ids[0]];
    if (!char) continue;

    const variantSkillData  = {};
    const variantImages     = {};
    const variantCosts      = {};
    const variantStatBonus  = [];
    const variantSkillNodes = {};

    for (const nodeId of char.skill_trees ?? []) {
      const node = skillTrees[nodeId];
      if (!node) continue;

      if (node.level_up_skills?.length > 0) {
        const skillId = node.level_up_skills[0].id;
        const skill = skills[skillId];
        if (!skill) continue;
        const key = SKILL_KEY_MAP[skill.type_text];
        if (!key) continue;
        variantSkillNodes[key] = node;
        variantSkillData[key]  = parseSkillDesc(skill);
        variantImages[key]     = cdnUrl(skill.icon);
      } else {
        const props = node.levels?.[0]?.properties ?? [];
        const unlockPhase = node.levels?.[0]?.promotion ?? 0;
        for (const prop of props) {
          variantStatBonus.push({ stat: prop.type, value: prop.value, unlockPhase });
        }
      }
    }

    for (const [key, node] of Object.entries(variantSkillNodes)) {
      variantCosts[key] = buildSkillCosts(node, items);
    }

    trailblazerVariants[group.element] = {
      basicAtk:   variantSkillData.basicAtk  ?? null,
      skill:      variantSkillData.skill     ?? null,
      ultimate:   variantSkillData.ultimate  ?? null,
      talent:     variantSkillData.talent    ?? null,
      technique:  variantSkillData.technique ?? null,
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

    await upsert(Eidolon, { game: GAME, name: char.name }, {
      game: GAME,
      name: char.name,
      ...eidolons,
      images,
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
      effectTemplateRaw: rank?.desc ?? null,
      stats,
      superimpositions,
      costs,
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

async function seedRelics(relicSets, relicPieces) {
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
    });
    count++;
  }
  console.log(`  ✓ Seeded ${count} relic sets`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   Honkai: Star Rail Database Seeder  ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Mode: ${forceOverwrite ? "FORCE OVERWRITE" : "UPSERT (safe)"}\n`);

  await connectDB();

  if (forceOverwrite) {
    console.log("⚠  Dropping existing HSR data...");
    await Character.deleteMany({ game: GAME });
    await Material.deleteMany({ game: GAME });
    await LightCone.deleteMany({ game: GAME });
    await Relic.deleteMany({ game: GAME });
    await Trace.deleteMany({ game: GAME });
    await Eidolon.deleteMany({ game: GAME });
    console.log("  Done.\n");
  }

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
  console.log("  ✓ All data fetched\n");

  const start = Date.now();

  console.log("[1/6] Seeding materials...");
  await seedMaterials(items);

  console.log("[2/6] Seeding characters...");
  await seedCharacters(characters, promotions);

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

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
