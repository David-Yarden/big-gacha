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
const {
  Character,
  Weapon,
  Artifact,
  Material,
  Talent,
  Constellation,
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

// ─── Helpers ─────────────────────────────────────────────

function getAllNames(folder) {
  return genshindb[folder]("names", { matchCategories: true }) || [];
}

function getData(folder, name) {
  return genshindb[folder](name);
}

async function upsert(Model, filter, data) {
  return Model.findOneAndUpdate(filter, data, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
}

// ─── Seed Characters ─────────────────────────────────────

async function seedCharacters() {
  const names = getAllNames("characters");
  console.log(`  Found ${names.length} characters`);

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
      region: CHARACTER_REGION_OVERRIDES[data.name] ?? data.region,
      stats: statsPerLevel,
      affiliation: data.affiliation,
      associationType: data.associationType,
      birthday: data.birthday,
      birthdaymmdd: data.birthdaymmdd,
      constellation: data.constellation,
      substatType: data.substatType,
      substatText: data.substatText,
      version: data.version,
      cv: data.cv,
      costs: data.costs,
      images: data.images,
      url: data.url,
      availableElements,
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

async function seedArtifacts() {
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
    await Talent.findOneAndUpdate(
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
      },
      { upsert: true, new: true }
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
  const deleted = await Constellation.deleteMany({ game: GAME, name: { $in: MANEKIN_NAMES } });
  if (deleted.deletedCount) console.log(`  Removed ${deleted.deletedCount} stale Manekin constellation doc(s)`);

  console.log(`  ✓ Seeded ${count} constellation sets (incl. ${TRAVELER_NAMES.length} Travelers)`);
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   Genshin Impact Database Seeder     ║");
  console.log("╚══════════════════════════════════════╝");
  console.log(`Mode: ${forceOverwrite ? "FORCE OVERWRITE" : "UPSERT (safe)"}\n`);

  await connectDB();

  if (forceOverwrite) {
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

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
