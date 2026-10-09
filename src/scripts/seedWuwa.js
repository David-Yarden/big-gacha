/**
 * Wuthering Waves Data Seeder
 *
 * Pulls character, weapon, echo, forte, and resonance chain data from
 * Dimbreath/WutheringData (GitHub) and imports it into MongoDB.
 *
 * Run:       npm run seed:wuwa
 * Overwrite: npm run seed:wuwa:force
 *
 * Seed order (dependency-safe):
 *   1. Materials       — no dependencies
 *   2. Characters      — uses RoleInfo + BreachConf + property data
 *   3. Weapons         — uses WeaponConf + BreachConf + property data
 *   4. Fortes          — keyed by character name
 *   5. ResonanceChains — keyed by character name
 *   6. EchoSets        — no character dependencies
 *   7. Echoes          — depends on EchoSets (sonataSet FK)
 *
 * NOTE: This script requires WW-01 CDN research to be completed before
 * image URLs can be populated. Until then, images will be null.
 * Run with --force to overwrite existing documents.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const {
  Character,
  Material,
  Weapon,
  Forte,
  ResonanceChain,
  Echo,
  EchoSet,
} = require("../models");
const {
  fetchConfigDB,
  fetchTextMap,
  resolveElement,
  resolveWeaponType,
  resolveCharacterText,
  resolveWeaponText,
  characterIconUrl,
  weaponIconUrl,
  computeStats,
  buildAscensionCosts,
  ROVER_IDS,
  ROVER_ELEMENTS,
} = require("./wuwaData");

const GAME = "wuwa";
const forceOverwrite = process.argv.includes("--force");

// ── Known playable character IDs ────────────────────────────────────────────
// Filter RoleInfo to these IDs to avoid NPCs, trial enemies, and test entries.
// RoleType: 1 = playable, IsShow: true = publicly visible.
// This set will expand with each version update.
const PLAYABLE_ROLE_TYPES = new Set([1]);

// ── Version map ─────────────────────────────────────────────────────────────
// Source: Official WuWa patch notes / community wikis
const WUWA_VERSION_MAP = {
  // v1.0 (Global Launch May 22, 2024)
  "Yangyang":     "1.0",
  "Chixia":       "1.0",
  "Baizhi":       "1.0",
  "Lingyang":     "1.0",
  "Rover":        "1.0",
  "Verina":       "1.0",
  "Aalto":        "1.0",
  "Taoqi":        "1.0",
  "Jianxin":      "1.0",
  "Calcharo":     "1.0",
  "Encore":       "1.0",
  "Jiyan":        "1.0",
  "Mortefi":      "1.0",
  "Danjin":       "1.0",
  "Sanhua":       "1.0",
  "Yuanwu":       "1.0",

  // v1.1 (June 2024)
  "Jinhsi":       "1.1",
  "Changli":      "1.1",

  // v1.2 (July 2024)
  "Yinlin":       "1.2",
  "Xiangli Yao":  "1.2",

  // v1.3 (September 2024)
  "Shorekeeper":  "1.3",
  "Camellya":     "1.3",

  // v1.4 (November 2024)
  "Roccia":       "1.4",
  "Zani":         "1.4",

  // v2.0 (January 2025)
  "Brant":        "2.0",
  "Phoebe":       "2.0",

  // v2.1 (March 2025)
  "Cantarella":   "2.1",
  "Ciaccona":     "2.1",
};

// ── Region map ───────────────────────────────────────────────────────────────
// WuWa nations — mapped from character affiliation/nationality data.
// TODO: populate from InfluenceConf.json or similar during data exploration.
const WUWA_REGION_MAP = {
  "Yangyang":     "Jinzhou",
  "Chixia":       "Jinzhou",
  "Baizhi":       "Jinzhou",
  "Lingyang":     "Huanglong",
  "Rover":        null,
  "Verina":       "Jinzhou",
  "Aalto":        "Others",
  "Taoqi":        "Jinzhou",
  "Jianxin":      "Jinzhou",
  "Calcharo":     "Jinzhou",
  "Encore":       "Jinzhou",
  "Jiyan":        "Jinzhou",
  "Mortefi":      "Jinzhou",
  "Danjin":       "Jinzhou",
  "Sanhua":       "Mt. Firmament",
  "Yuanwu":       "Jinzhou",
  "Jinhsi":       "Huanglong",
  "Changli":      "Huanglong",
  "Yinlin":       "Jinzhou",
  "Xiangli Yao":  "Huanglong",
  "Shorekeeper":  null,
  "Camellya":     "Others",
  "Roccia":       "Ragunna",
  "Zani":         "Ragunna",
  "Brant":        "Ragunna",
  "Phoebe":       "Ragunna",
  "Cantarella":   "Ragunna",
  "Ciaccona":     "Ragunna",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

async function upsert(Model, filter, update) {
  if (forceOverwrite) {
    await Model.findOneAndUpdate(filter, { $set: update }, { upsert: true, new: true });
  } else {
    const existing = await Model.findOne(filter);
    if (!existing) {
      await Model.create({ ...filter, ...update });
    }
  }
}

// ── 1. Materials ─────────────────────────────────────────────────────────────

async function seedMaterials() {
  console.log("  Seeding WuWa materials...");

  // TODO (WW-08): Fetch ItemInfo.json from ConfigDB and filter to WuWa materials.
  // Categories to seed:
  //   "Resonator Ascension" — Forgery Challenge boss drops (e.g. Bell-Borne Geocite)
  //   "Weapon Ascension"    — Weapon upgrade materials
  //   "Forte Upgrade"       — Skill books (from Forgery Challenges)
  //   "Boss Material"       — Weekly boss materials
  //   "Common Enemy Drop"   — Enemy drops (3 tiers per type)
  //   "Local Specialty"     — Region-specific items
  //   "EXP Material"        — Resonance Potion tiers
  //   "Shell Credits"       — Primary currency

  // Placeholder: create Shell Credits entry
  await upsert(
    Material,
    { game: GAME, name: "Shell Credits" },
    {
      description: "The main currency of the Huanglong region.",
      category: "Shell Credits",
      materialType: "currency",
      rarity: 1,
    }
  );

  console.log("  Materials: placeholder seeded (full implementation pending WW-08 data mapping)");
}

// ── 2. Characters ─────────────────────────────────────────────────────────────

async function seedCharacters() {
  console.log("  Seeding WuWa characters...");

  // Fetch raw data
  const roleInfoRaw = await fetchConfigDB("RoleInfo.json");
  const roleTextMap = await fetchTextMap("RoleInfo");

  // Filter to playable, visible resonators (excludes NPCs, trial dummies, test entries)
  const playableRoles = roleInfoRaw.filter(
    (r) => r.RoleType === 1 && r.IsShow === true && r.QualityId >= 4
  );

  let count = 0;

  for (let i = 0; i < playableRoles.length; i++) {
    const role = playableRoles[i];
    const textIdx = i; // 0-based index into the text map's 4-entry blocks
    const text = resolveCharacterText(roleTextMap, textIdx);

    if (!text.name) {
      console.warn(`    Skipping role ${role.Id} — no text resolved`);
      continue;
    }

    const element   = resolveElement(role.ElementId);
    const weaponType = resolveWeaponType(role.WeaponType);
    const isRover   = ROVER_IDS.has(role.Id);
    const charName  = isRover ? "Rover" : text.name;

    // Build the character document
    const doc = {
      sourceId:    role.Id,
      title:       text.title || undefined,
      description: text.description || undefined,
      rarity:      role.QualityId,
      element:     isRover ? null : element,
      weaponType,
      region:      WUWA_REGION_MAP[charName] ?? null,
      version:     WUWA_VERSION_MAP[charName] ?? null,
      images: {
        icon: characterIconUrl(role.Id),
        // TODO (WW-01): add splash, sideIcon once CDN is confirmed
      },
      // Rover: list both element variants
      availableElements: isRover ? ROVER_ELEMENTS : undefined,
    };

    // TODO (WW-08): Add stats (pre-computed via computeStats) and costs (ascension) once
    //               BreachConf.json and RolePropertyGrowth.json structure is mapped.

    await upsert(Character, { game: GAME, name: charName }, doc);
    count++;
  }

  console.log(`  Characters: ${count} seeded`);
}

// ── 3. Weapons ────────────────────────────────────────────────────────────────

async function seedWeapons() {
  console.log("  Seeding WuWa weapons...");

  const weaponRaw = await fetchConfigDB("WeaponConf.json");
  const weaponTextMap = await fetchTextMap("WeaponConf");

  // Filter to visible weapons with quality 3–5
  const validWeapons = weaponRaw.filter((w) => w.IsShow === true && w.QualityId >= 3);

  let count = 0;

  for (let i = 0; i < validWeapons.length; i++) {
    const weapon = validWeapons[i];
    const text = resolveWeaponText(weaponTextMap, i);

    if (!text.name) continue;

    const doc = {
      sourceId:  weapon.ItemId,
      rarity:    weapon.QualityId,
      weaponType: resolveWeaponType(weapon.WeaponType),
      // TODO (WW-08): map FirstPropId/SecondPropId to mainStatType/baseAtkValue
      images: {
        icon: weaponIconUrl(weapon.ItemId),
      },
    };

    await upsert(Weapon, { game: GAME, name: text.name }, doc);
    count++;
  }

  console.log(`  Weapons: ${count} seeded`);
}

// ── 4. Fortes ─────────────────────────────────────────────────────────────────

async function seedFortes() {
  console.log("  Seeding WuWa fortes...");

  // TODO (WW-08): Map skill tree data from ConfigDB.
  // Relevant files (to be confirmed during WW-00 data exploration):
  //   SkillDescribe.json  — skill descriptions with param placeholders
  //   SkillTree.json      — forte tree node structure
  //   BattlePassTask.json — may contain skill upgrade cost data
  //
  // For each resonator:
  //   - Parse 5 leveled skills: basicAtk, resonanceSkill, resonanceLiberation, forteCircuit, introSkill
  //   - Parse 2 inherent skills (passive, milestone-unlocked)
  //   - Parse stat bonus nodes
  //   - Build costs using buildForteCosts()

  console.log("  Fortes: pending WW-08 data mapping (skill tree structure not yet confirmed)");
}

// ── 5. Resonance Chains ───────────────────────────────────────────────────────

async function seedResonanceChains() {
  console.log("  Seeding WuWa resonance chains...");

  // TODO (WW-08): Map resonance chain data from ConfigDB.
  // Likely file: WaveConf.json or RoleResonanceChain.json (name TBC).
  // For each resonator: parse S1–S6 name, description, icon.
  // Rover: create with elementVariants { Spectro: {...}, Havoc: {...} }.

  console.log("  Resonance Chains: pending WW-08 data mapping");
}

// ── 6. Echo Sets ──────────────────────────────────────────────────────────────

async function seedEchoSets() {
  console.log("  Seeding WuWa echo sets (Sonata Effects)...");

  // Known echo sets as of v3.1 (manually curated, to be replaced with ConfigDB data)
  const knownSets = [
    { name: "Freezing Frost",      element: "Glacio",  twoPieceBonus: "Glacio DMG +10%", fivePieceBonus: "After using Resonance Skill or Basic Attack that hits a target, Glacio DMG increases by 10% for 15s, stacking up to 3 times." },
    { name: "Molten Rift",         element: "Fusion",  twoPieceBonus: "Fusion DMG +10%", fivePieceBonus: "After using Resonance Skill, Fusion DMG increases by 30% for 15s." },
    { name: "Void Thunder",        element: "Electro", twoPieceBonus: "Electro DMG +10%", fivePieceBonus: "After using Resonance Skill or Resonance Liberation, Electro DMG increases by 15% for 15s, stacking up to 2 times." },
    { name: "Sierra Gale",         element: "Aero",    twoPieceBonus: "Aero DMG +10%", fivePieceBonus: "After using Resonance Skill, Aero DMG increases by 30% for 15s." },
    { name: "Celestial Light",     element: "Spectro", twoPieceBonus: "Spectro DMG +10%", fivePieceBonus: "After using Resonance Skill, Spectro DMG increases by 30% for 15s." },
    { name: "Sun-Sinking Eclipse", element: "Havoc",   twoPieceBonus: "Havoc DMG +10%", fivePieceBonus: "After using Resonance Skill or Basic Attack that hits a target, Havoc DMG increases by 10% for 15s, stacking up to 3 times." },
    { name: "Lingering Tunes",     element: null,      twoPieceBonus: "ATK +10%", fivePieceBonus: "Increases ATK by 5% every 1.5s while on the field, stacking up to 4 times. This effect persists for 3s after leaving the field. When this effect reaches max stacks, ATK increases by an additional 10%." },
    { name: "Rejuvenating Glow",   element: null,      twoPieceBonus: "Healing Bonus +10%", fivePieceBonus: "Increases the ATK of all team members by 15% for 30s after using Resonance Skill to heal allies." },
    { name: "Moonlit Clouds",      element: null,      twoPieceBonus: "Energy Regen +10%", fivePieceBonus: "After using Outro Skill, the ATK of the next resonator to take the field increases by 22.5% for 15s." },
    { name: "Tidebreaking Courage",element: null,      twoPieceBonus: "Energy Regen +10%", fivePieceBonus: "While Energy Regen exceeds 250%, each excess 10% ER converts to 3% DMG Bonus. Max 12 stacks." },
  ];

  let count = 0;
  for (const set of knownSets) {
    await upsert(EchoSet, { game: GAME, name: set.name }, {
      twoPieceBonus: set.twoPieceBonus,
      fivePieceBonus: set.fivePieceBonus,
      element: set.element,
    });
    count++;
  }

  console.log(`  Echo Sets: ${count} seeded`);
}

// ── 7. Echoes ─────────────────────────────────────────────────────────────────

async function seedEchoes() {
  console.log("  Seeding WuWa echoes...");

  // TODO (WW-08): Fetch and parse PhantomHandBook.json + PhantomSkill.json.
  // PhantomHandBook.json has echo IDs and TextMap references.
  // PhantomSkill.json has the active echo skills with params.
  // Map echo → cost class based on monster tier:
  //   Common (1-cost): small creatures
  //   Elite (3-cost):  elite enemies
  //   Overlord (4-cost): overlord bosses
  //   Calamity (4-cost): calamity-tier bosses

  console.log("  Echoes: pending WW-08 data mapping (PhantomHandBook structure needs parsing)");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await connectDB();

  console.log(`\nSeeding WuWa data${forceOverwrite ? " (force overwrite)" : ""}...`);

  try {
    await seedMaterials();
    await seedCharacters();
    await seedWeapons();
    await seedFortes();
    await seedResonanceChains();
    await seedEchoSets();
    await seedEchoes();
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nDone.");
  }
}

main();
