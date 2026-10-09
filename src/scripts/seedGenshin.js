/**
 * Genshin Impact Data Seeder
 *
 * Pulls all data from the genshin-db npm package and imports it into MongoDB.
 * Run: npm run seed:genshin
 * Run with overwrite: npm run seed:genshin:force
 */

require("dotenv").config();
const mongoose = require("mongoose");
const genshindb = require("genshin-db");
const connectDB = require("../config/db");
const sink = require("../sync/sink");
delete require.cache[require.resolve("./signatures")]; // edits to the table apply on the next sync
const { signatureOf, signatureWeapon } = require("./signatures");
const {
  Character,
  Weapon,
  Artifact,
  Material,
  Talent,
  Constellation,
  Reference,
} = require("../models");

const GAME = "genshin";
const forceOverwrite = process.argv.includes("--force");

const TRAVELER_NAMES    = ["Aether", "Lumine"];  // element-variant Travelers
const MANEKIN_NAMES     = ["Manekin", "Manekina"]; // Natlan Travelers with their own flat kit
const TRAVELER_ELEMENTS = ["Anemo", "Geo", "Electro", "Dendro", "Hydro", "Pyro"];

// Characters whose region is missing or wrong in genshin-db
const CHARACTER_REGION_OVERRIDES = {
  Zibai: "Liyue",
};

// When genshin-db leaves region empty, derive it from the association
// (e.g. ASSOC_SNEZHNAYA / ASSOC_SNEZHNAYA_STAR for Alyosha, Odette, Sandrone).
// Associations that are not a nation (Traveler, Hexenzirkel, Omni-Scourge…) stay empty.
const ASSOCIATION_REGIONS = [
  [/^ASSOC_(MONDSTADT)/, "Mondstadt"],
  [/^ASSOC_(LIYUE)/, "Liyue"],
  [/^ASSOC_(INAZUMA)/, "Inazuma"],
  [/^ASSOC_(SUMERU)/, "Sumeru"],
  [/^ASSOC_(FONTAINE)/, "Fontaine"],
  [/^ASSOC_(NATLAN)/, "Natlan"],
  [/^ASSOC_(NODKRAI|NOD_KRAI)/, "Nod-Krai"],
  [/^ASSOC_(SNEZHNAYA|FATUI)/, "Snezhnaya"],
];

function resolveRegion(data) {
  if (CHARACTER_REGION_OVERRIDES[data.name]) return CHARACTER_REGION_OVERRIDES[data.name];
  if (data.region) return data.region;
  const hit = ASSOCIATION_REGIONS.find(([re]) => re.test(data.associationType || ""));
  return hit ? hit[1] : undefined;
}

// ─── Helpers ─────────────────────────────────────────────

function getAllNames(folder) {
  return genshindb[folder]("names", { matchCategories: true }) || [];
}

function getData(folder, name) {
  return genshindb[folder](name);
}

async function upsert(Model, filter, data) {
  return sink.upsert(Model, filter, data);
}

// ─── Outfits ─────────────────────────────────────────────
const ENKA_UI = "https://enka.network/ui";
let OUTFITS = null; // character name → outfits

/**
 * Outfits of a character (only when it has more than its default one). The default keeps
 * the character's own splash; the others use their costume art (UI_Costume_*).
 */
function characterSkins(name, charImages) {
  if (!OUTFITS) {
    OUTFITS = new Map();
    const names = genshindb.outfits("names", { matchCategories: true }) || [];
    for (const n of names) {
      const o = genshindb.outfits(n);
      if (!o?.characterName) continue;
      (OUTFITS.get(o.characterName) ?? OUTFITS.set(o.characterName, []).get(o.characterName)).push(o);
    }
  }
  const list = OUTFITS.get(name) || [];
  if (!list.some((o) => !o.isDefault)) return undefined;
  const png = (f) => (f ? `${ENKA_UI}/${f}.png` : undefined);
  const hasDefault = list.some((o) => o.isDefault);
  const out = list
    .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || a.id - b.id)
    .map((o) => ({
      name: o.name,
      desc: o.description || undefined,
      default: o.isDefault || undefined,
      splash: o.isDefault ? undefined : png(o.images?.filename_splash),
      icon: png(o.images?.filename_icon) ?? (o.isDefault ? png(charImages?.filename_icon) : undefined),
    }));
  if (!hasDefault) out.unshift({ name, default: true, icon: png(charImages?.filename_icon) });
  return out;
}

// ─── Seed Characters ─────────────────────────────────────

async function seedCharacters() {
  const names = getAllNames("characters");
  console.log(`  Found ${names.length} characters`);

  // Hover glossary per character (Project Amber), fetched in parallel beforehand
  const { genshinGlossary, mapLimit } = require("../sync/glossary");
  const all = names.map((n) => getData("characters", n)).filter(Boolean);
  const glossaries = new Map();
  await mapLimit(all, 6, async (data) => {
    const ids = TRAVELER_NAMES.includes(data.name)
      ? TRAVELER_ELEMENTS.map((el) => `${data.id}-${el.toLowerCase()}`)
      : [data.id];
    glossaries.set(data.name, await genshinGlossary(ids));
  });
  console.log(`  ✓ Glossaries for ${[...glossaries.values()].filter(Boolean).length} characters`);

  let count = 0;
  for (const name of names) {
    const data = getData("characters", name);
    if (!data) continue;

    // Pre-compute stats for every level so the frontend can display them without genshin-db
    const statsPerLevel = {};
    for (let lv = 1; lv <= 90; lv++) {
      const s = data.stats(lv);
      statsPerLevel[lv] = { hp: s.hp, atk: s.attack, def: s.defense, specialized: s.specialized };
    }

    // availableElements: only the element-variant Travelers (Aether/Lumine) get this
    const availableElements = TRAVELER_NAMES.includes(data.name)
      ? TRAVELER_ELEMENTS.filter((el) => !!getData("talents", `Traveler (${el})`))
      : [];

    await upsert(Character, { game: GAME, name: data.name }, {
      game: GAME,
      sourceId: data.id,
      name: data.name,
      title: data.title,
      description: data.description,
      rarity: data.rarity,
      element: data.elementText,
      elementType: data.elementType,
      weaponType: data.weaponText,
      weaponTypeRaw: data.weaponType,
      bodyType: data.bodyType,
      gender: data.gender,
      region: resolveRegion(data),
      stats: statsPerLevel,
      affiliation: data.affiliation,
      associationType: data.associationType,
      birthday: data.birthday,
      birthdaymmdd: data.birthdaymmdd,
      constellation: data.constellation,
      substatType: data.substatType,
      substatText: data.substatText,
      version: data.version,
      signatureWeapon: signatureWeapon(GAME, data.name),
      cv: data.cv,
      costs: data.costs,
      images: data.images,
      url: data.url,
      skins: characterSkins(data.name, data.images),
      availableElements,
      glossary: glossaries.get(data.name),
    });
    count++;
  }
  console.log(`  ✓ Seeded ${count} characters`);
}

// ─── Seed Weapons ────────────────────────────────────────

async function seedWeapons() {
  const names = getAllNames("weapons");
  console.log(`  Found ${names.length} weapons`);

  let count = 0;
  for (const name of names) {
    const data = getData("weapons", name);
    if (!data) continue;

    const statsPerLevel = {};
    if (typeof data.stats === "function") {
      for (let lv = 1; lv <= 90; lv++) {
        const s = data.stats(lv);
        if (s) statsPerLevel[lv] = { atk: s.attack, specialized: s.specialized };
      }
    }

    await upsert(Weapon, { game: GAME, name: data.name }, {
      game: GAME,
      sourceId: data.id,
      name: data.name,
      description: data.description,
      weaponType: data.weaponText,
      rarity: data.rarity,
      baseAtkValue: data.baseAtkValue,
      mainStatType: data.mainStatType,
      mainStatText: data.mainStatText,
      baseStatText: data.baseStatText,
      effectName: data.effectName,
      effectTemplateRaw: data.effectTemplateRaw,
      version: data.version,
      signatureOf: signatureOf(GAME, data.name),
      stats: statsPerLevel,
      refinements: [data.r1, data.r2, data.r3, data.r4, data.r5].filter(Boolean),
      costs: data.costs,
      images: data.images,
      url: data.url,
    });
    count++;
  }
  console.log(`  ✓ Seeded ${count} weapons`);
}

// ─── Seed Artifacts ──────────────────────────────────────

/**
 * Reference table for the Artifacts page: 5★ main stats per piece (+0 → +20) and the four
 * possible values of a substat roll. genshin-db has no such table; these values have not
 * changed since the game's release (1.0).
 */
const ARTIFACT_MAIN = {
  "HP": ["717", "4,780"], "ATK": ["47", "311"],
  "HP%": ["7.0%", "46.6%"], "ATK%": ["7.0%", "46.6%"], "DEF%": ["8.7%", "58.3%"],
  "Elemental Mastery": ["28.0", "186.5"], "Energy Recharge": ["7.8%", "51.8%"],
  "Elemental DMG Bonus": ["7.0%", "46.6%"], "Physical DMG Bonus": ["8.7%", "58.3%"],
  "CRIT Rate": ["4.7%", "31.1%"], "CRIT DMG": ["9.3%", "62.2%"], "Healing Bonus": ["5.4%", "35.9%"],
};
const ARTIFACT_SLOTS = [
  ["Flower of Life", ["HP"]],
  ["Plume of Death", ["ATK"]],
  ["Sands of Eon", ["HP%", "ATK%", "DEF%", "Elemental Mastery", "Energy Recharge"]],
  ["Goblet of Eonothem", ["HP%", "ATK%", "DEF%", "Elemental Mastery", "Elemental DMG Bonus", "Physical DMG Bonus"]],
  ["Circlet of Logos", ["HP%", "ATK%", "DEF%", "Elemental Mastery", "CRIT Rate", "CRIT DMG", "Healing Bonus"]],
];
const ARTIFACT_SUBS = [
  ["HP", "209 / 239 / 269 / 299"], ["ATK", "13.6 / 15.6 / 17.5 / 19.5"], ["DEF", "16.2 / 18.5 / 20.8 / 23.1"],
  ["HP%", "4.1% / 4.7% / 5.2% / 5.8%"], ["ATK%", "4.1% / 4.7% / 5.2% / 5.8%"], ["DEF%", "5.1% / 5.8% / 6.6% / 7.3%"],
  ["Elemental Mastery", "16.3 / 18.7 / 21.0 / 23.3"], ["Energy Recharge", "4.5% / 5.2% / 5.8% / 6.5%"],
  ["CRIT Rate", "2.7% / 3.1% / 3.5% / 3.9%"], ["CRIT DMG", "5.4% / 6.2% / 7.0% / 7.8%"],
];

async function seedArtifactStats() {
  await upsert(Reference, { game: GAME, name: "Artifact stats" }, {
    game: GAME,
    name: "Artifact stats",
    data: {
      rank: "5★",
      slots: ARTIFACT_SLOTS.map(([slot, stats]) => ({
        slot,
        maxLevel: 20,
        mainStats: stats.map((name) => ({ name, base: ARTIFACT_MAIN[name][0], max: ARTIFACT_MAIN[name][1] })),
      })),
      substats: ARTIFACT_SUBS.map(([name, value]) => ({ name, value })),
      substatNote: "The four possible values of one roll",
    },
  });
}

async function seedArtifacts() {
  await seedArtifactStats();
  const names = getAllNames("artifacts");
  console.log(`  Found ${names.length} artifact sets`);

  let count = 0;
  for (const name of names) {
    const data = getData("artifacts", name);
    if (!data) continue;

    await upsert(Artifact, { game: GAME, name: data.name }, {
      game: GAME,
      name: data.name,
      rarity: data.rarityList,
      twoPieceBonus: data.effect2Pc,
      fourPieceBonus: data.effect4Pc,
      version: data.version,
      pieces: {
        flower: data.flower,
        plume: data.plume,
        sands: data.sands,
        goblet: data.goblet,
        circlet: data.circlet,
      },
      images: data.images,
      url: data.url,
    });
    count++;
  }
  console.log(`  ✓ Seeded ${count} artifact sets`);
}

// ─── Seed Materials ──────────────────────────────────────

async function seedMaterials() {
  const names = getAllNames("materials");
  console.log(`  Found ${names.length} materials`);

  let count = 0;
  for (const name of names) {
    const data = getData("materials", name);
    if (!data) continue;

    await upsert(Material, { game: GAME, name: data.name }, {
      game: GAME,
      sourceId: data.id,
      name: data.name,
      description: data.description,
      category: data.category,
      materialType: data.materialType,
      rarity: data.rarity,
      source: data.sources,
      version: data.version,
      images: data.images,
    });
    count++;
  }
  console.log(`  ✓ Seeded ${count} materials`);
}

// ─── Seed Talents ────────────────────────────────────────

async function seedTalents() {
  const names = getAllNames("talents");
  console.log(`  Found ${names.length} talent sets`);

  let count = 0;
  for (const name of names) {
    // Skip "Traveler (Anemo)" etc. and Manekin/Manekina — handled separately below
    if (/^Traveler \(/.test(name)) continue;
    if (MANEKIN_NAMES.includes(name)) continue;

    const data = getData("talents", name);
    if (!data) continue;

    await upsert(Talent, { game: GAME, name: data.name }, {
      game: GAME,
      name: data.name,
      combat1: data.combat1,
      combat2: data.combat2,
      combat3: data.combat3,
      combatsp: data.combatsp,
      passive1: data.passive1,
      passive2: data.passive2,
      passive3: data.passive3,
      passive4: data.passive4,
      costs: data.costs,
      images: data.images,
    });
    count++;
  }

  // Build Traveler elementVariants and upsert one doc per Traveler name
  const elementVariants = {};
  for (const el of TRAVELER_ELEMENTS) {
    const data = getData("talents", `Traveler (${el})`);
    if (!data) continue;
    elementVariants[el] = {
      combat1:  data.combat1,
      combat2:  data.combat2,
      combat3:  data.combat3,
      combatsp: data.combatsp,
      passive1: data.passive1,
      passive2: data.passive2,
      passive3: data.passive3,
      passive4: data.passive4,
      costs:    data.costs,
      images:   data.images,
    };
  }

  for (const travelerName of TRAVELER_NAMES) {
    await upsert(Talent, { game: GAME, name: travelerName }, {
      game: GAME,
      name: travelerName,
      isTraveler: true,
      elementVariants,
    });
    count++;
  }

  // Seed Manekin/Manekina with their own flat kit; explicitly clear any stale traveler fields
  for (const manekinName of MANEKIN_NAMES) {
    const data = getData("talents", manekinName);
    if (!data) continue;
    await sink.update(
      Talent,
      { game: GAME, name: manekinName },
      {
        $set: {
          game: GAME,
          name: data.name,
          combat1: data.combat1,
          passive1: data.passive1,
          passive2: data.passive2,
          passive3: data.passive3,
          costs: data.costs,
          images: data.images,
        },
        $unset: { isTraveler: "", elementVariants: "", combat2: "", combat3: "", combatsp: "", passive4: "" },
      }
    );
    count++;
  }

  console.log(`  ✓ Seeded ${count} talent sets (incl. ${TRAVELER_NAMES.length} Travelers + ${MANEKIN_NAMES.length} Manekins)`);
}

// ─── Seed Constellations ─────────────────────────────────

async function seedConstellations() {
  const names = getAllNames("constellations");
  console.log(`  Found ${names.length} constellation sets`);

  let count = 0;
  for (const name of names) {
    // Skip "Traveler (Anemo)" etc. — handled separately below
    if (/^Traveler \(/.test(name)) continue;

    const data = getData("constellations", name);
    if (!data) continue;

    await upsert(Constellation, { game: GAME, name: data.name }, {
      game: GAME,
      name: data.name,
      c1: data.c1,
      c2: data.c2,
      c3: data.c3,
      c4: data.c4,
      c5: data.c5,
      c6: data.c6,
      images: data.images,
    });
    count++;
  }

  // Build Traveler elementVariants and upsert one doc per Traveler name
  const elementVariants = {};
  for (const el of TRAVELER_ELEMENTS) {
    const data = getData("constellations", `Traveler (${el})`);
    if (!data) continue;
    elementVariants[el] = {
      c1: data.c1,
      c2: data.c2,
      c3: data.c3,
      c4: data.c4,
      c5: data.c5,
      c6: data.c6,
      images: data.images,
    };
  }

  for (const travelerName of TRAVELER_NAMES) {
    await upsert(Constellation, { game: GAME, name: travelerName }, {
      game: GAME,
      name: travelerName,
      isTraveler: true,
      elementVariants,
    });
    count++;
  }

  // Manekin/Manekina have no constellation data — remove any stale documents from previous seeds
  const deleted = await sink.deleteMany(Constellation, { game: GAME, name: { $in: MANEKIN_NAMES } });
  if (deleted.deletedCount) console.log(`  Removed ${deleted.deletedCount} stale Manekin constellation doc(s)`);

  console.log(`  ✓ Seeded ${count} constellation sets (incl. ${TRAVELER_NAMES.length} Travelers)`);
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   Genshin Impact Database Seeder     ║");
  console.log("╚══════════════════════════════════════╝");
  const modeLabel = forceOverwrite ? "FORCE OVERWRITE (backup first)" : "UPSERT (safe)";
  console.log(`Mode: ${modeLabel}\n`);

  await connectDB();

  if (forceOverwrite) {
    const backup = await require("./backup").backupGame(GAME, "before-force-genshin");
    console.log(`💾 Sauvegarde avant effacement : backups/${backup}`);
    console.log("⚠  Dropping existing Genshin data...");
    await Character.deleteMany({ game: GAME });
    await Weapon.deleteMany({ game: GAME });
    await Artifact.deleteMany({ game: GAME });
    await Material.deleteMany({ game: GAME });
    await Talent.deleteMany({ game: GAME });
    await Constellation.deleteMany({ game: GAME });
    console.log("  Done.\n");
  }

  const start = Date.now();

  console.log("[1/6] Seeding characters...");
  await seedCharacters();

  console.log("[2/6] Seeding weapons...");
  await seedWeapons();

  console.log("[3/6] Seeding artifacts...");
  await seedArtifacts();

  console.log("[4/6] Seeding materials...");
  await seedMaterials();

  console.log("[5/6] Seeding talents...");
  await seedTalents();

  console.log("[6/6] Seeding constellations...");
  await seedConstellations();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Genshin seed complete in ${elapsed}s`);

  await mongoose.connection.close();
  process.exit(0);
}

/** Run every Genshin seeder (used by the sync engine in recording mode). */
async function seedAll() {
  await seedCharacters();
  await seedWeapons();
  await seedArtifacts();
  await seedMaterials();
  await seedTalents();
  await seedConstellations();
}

module.exports = { seedAll, GAME };

if (require.main === module) {
  main().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
