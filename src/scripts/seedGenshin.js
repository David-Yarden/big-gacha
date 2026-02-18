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
      region: data.region,
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
      rarity: data.rarity,
      twoPieceBonus: data.twoPieceBonus,
      fourPieceBonus: data.fourPieceBonus,
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
      source: data.source,
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
  console.log(`  ✓ Seeded ${count} talent sets`);
}

// ─── Seed Constellations ─────────────────────────────────

async function seedConstellations() {
  const names = getAllNames("constellations");
  console.log(`  Found ${names.length} constellation sets`);

  let count = 0;
  for (const name of names) {
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
  console.log(`  ✓ Seeded ${count} constellation sets`);
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
