require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const apiRoutes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ─── Routes ──────────────────────────────────────────────
app.use("/api", apiRoutes);

// ─── Health check ────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found. Visit GET /api for available endpoints.`,
  });
});

// ─── Error handler ───────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────
async function autoSeed() {
  const { Character } = require("./models");
  const count = await Character.countDocuments();
  if (count > 0) return;

  console.log("\n📦 Database is empty — auto-seeding Genshin data...");
  const genshindb = require("genshin-db");
  const { Weapon, Artifact, Material, Talent, Constellation } = require("./models");
  const GAME = "genshin";

  function getAllNames(folder) {
    return genshindb[folder]("names", { matchCategories: true }) || [];
  }
  function getData(folder, name) {
    return genshindb[folder](name);
  }
  async function upsert(Model, filter, data) {
    return Model.findOneAndUpdate(filter, data, { upsert: true, new: true, setDefaultsOnInsert: true });
  }

  const seeders = [
    { name: "characters", Model: Character, map: (d) => ({
      game: GAME, sourceId: d.id, name: d.name, title: d.title, description: d.description,
      rarity: d.rarity, element: d.elementText, elementType: d.elementType,
      weaponType: d.weaponText, weaponTypeRaw: d.weaponType, bodyType: d.bodyType,
      gender: d.gender, region: d.region, affiliation: d.affiliation,
      associationType: d.associationType, birthday: d.birthday, birthdaymmdd: d.birthdaymmdd,
      constellation: d.constellation, substatType: d.substatType, substatText: d.substatText,
      version: d.version, cv: d.cv, costs: d.costs, images: d.images, url: d.url,
    })},
    { name: "weapons", Model: Weapon, map: (d) => ({
      game: GAME, sourceId: d.id, name: d.name, description: d.description,
      weaponType: d.weaponText, rarity: d.rarity, baseAtkValue: d.baseAtkValue,
      mainStatType: d.mainStatType, mainStatText: d.mainStatText, baseStatText: d.baseStatText,
      effectName: d.effectName, effectTemplateRaw: d.effectTemplateRaw, version: d.version,
      refinements: [d.r1, d.r2, d.r3, d.r4, d.r5].filter(Boolean), costs: d.costs, images: d.images, url: d.url,
    })},
    { name: "artifacts", Model: Artifact, map: (d) => ({
      game: GAME, name: d.name, rarity: d.rarity, twoPieceBonus: d.twoPieceBonus,
      fourPieceBonus: d.fourPieceBonus, version: d.version,
      pieces: { flower: d.flower, plume: d.plume, sands: d.sands, goblet: d.goblet, circlet: d.circlet },
      images: d.images, url: d.url,
    })},
    { name: "materials", Model: Material, map: (d) => ({
      game: GAME, sourceId: d.id, name: d.name, description: d.description,
      category: d.category, materialType: d.materialType, rarity: d.rarity,
      source: d.source, version: d.version, images: d.images,
    })},
    { name: "talents", Model: Talent, map: (d) => ({
      game: GAME, name: d.name, combat1: d.combat1, combat2: d.combat2, combat3: d.combat3,
      combatsp: d.combatsp, passive1: d.passive1, passive2: d.passive2,
      passive3: d.passive3, passive4: d.passive4, costs: d.costs, images: d.images,
    })},
    { name: "constellations", Model: Constellation, map: (d) => ({
      game: GAME, name: d.name, c1: d.c1, c2: d.c2, c3: d.c3, c4: d.c4, c5: d.c5, c6: d.c6,
      images: d.images,
    })},
  ];

  const seedStart = Date.now();
  for (const { name, Model, map } of seeders) {
    const names = getAllNames(name);
    let n = 0;
    for (const nm of names) {
      const d = getData(name, nm);
      if (!d) continue;
      await upsert(Model, { game: GAME, name: d.name }, map(d));
      n++;
    }
    console.log(`  ✓ ${n} ${name}`);
  }
  console.log(`📦 Auto-seed complete in ${((Date.now() - seedStart) / 1000).toFixed(1)}s\n`);
}

async function start() {
  await connectDB();
  await autoSeed();
  app.listen(PORT, () => {
    console.log(`🎮 Big Gacha API running on http://localhost:${PORT}`);
    console.log(`📖 API docs at http://localhost:${PORT}/api\n`);
  });
}

start();
