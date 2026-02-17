# CLAUDE.md — Gacha DB Project Instructions

## Project Overview

Gacha DB is a multi-game gacha database REST API built with the MERN stack (MongoDB, Express, React, Node.js). It currently supports **Genshin Impact** with plans for HSR, ZZZ, Wuthering Waves, and Arknights: Endfield.

Data is sourced from the `genshin-db` npm package and imported into MongoDB via seed scripts. The API provides filtering, sorting, pagination, and search across all game data.

---

## Initial Setup (Run These Commands In Order)

### 1. Initialize the project

```bash
mkdir gacha-db && cd gacha-db
mkdir -p src/config src/models src/routes src/scripts src/middleware src/utils
npm init -y
```

### 2. Install dependencies

```bash
npm install express mongoose cors dotenv morgan genshin-db
npm install -D nodemon
```

### 3. Create the .env file

Create `.env` in the project root:

```env
MONGODB_URI=mongodb://localhost:27017/gacha-db
PORT=5000
NODE_ENV=development
```

> If using MongoDB Atlas instead of local: replace the URI with your Atlas connection string:
> `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/gacha-db`

### 4. Update package.json scripts

Replace the `"scripts"` block in `package.json` with:

```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js",
  "seed:genshin": "node src/scripts/seedGenshin.js",
  "seed:genshin:force": "node src/scripts/seedGenshin.js --force"
}
```

### 5. Create .gitignore

Create `.gitignore` in the project root:

```
node_modules/
.env
dist/
*.log
```

---

## File-by-File Creation Guide

Create each file below at the specified path relative to the project root.

---

### `src/config/db.js` — MongoDB Connection

```js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
```

---

### `src/models/Character.js` — Character Model

```js
const mongoose = require("mongoose");

const characterSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },
    sourceId: { type: Number },

    name: { type: String, required: true },
    title: String,
    description: String,
    rarity: { type: Number, index: true },
    element: { type: String, index: true },
    elementType: String,
    weaponType: { type: String, index: true },
    weaponTypeRaw: String,
    bodyType: String,
    gender: String,
    region: String,
    affiliation: String,
    associationType: String,

    birthday: String,
    birthdaymmdd: String,
    constellation: String,
    substatType: String,
    substatText: String,
    version: String,

    cv: {
      english: String,
      chinese: String,
      japanese: String,
      korean: String,
    },

    costs: { type: mongoose.Schema.Types.Mixed },
    images: { type: mongoose.Schema.Types.Mixed },
    url: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, collection: "characters" }
);

characterSchema.index({ game: 1, name: 1 }, { unique: true });
characterSchema.index({ game: 1, element: 1 });
characterSchema.index({ game: 1, weaponType: 1 });
characterSchema.index({ game: 1, rarity: 1 });
characterSchema.index({ game: 1, region: 1 });

module.exports = mongoose.model("Character", characterSchema);
```

---

### `src/models/Weapon.js` — Weapon Model

```js
const mongoose = require("mongoose");

const weaponSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },
    sourceId: Number,

    name: { type: String, required: true },
    description: String,
    weaponType: { type: String, index: true },
    rarity: { type: Number, index: true },
    baseAtkValue: Number,
    mainStatType: String,
    mainStatText: String,
    baseStatText: String,
    effectName: String,
    effectTemplateRaw: String,
    version: String,

    refinements: [mongoose.Schema.Types.Mixed],
    costs: mongoose.Schema.Types.Mixed,
    images: mongoose.Schema.Types.Mixed,
    url: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "weapons" }
);

weaponSchema.index({ game: 1, name: 1 }, { unique: true });
weaponSchema.index({ game: 1, weaponType: 1 });
weaponSchema.index({ game: 1, rarity: 1 });

module.exports = mongoose.model("Weapon", weaponSchema);
```

---

### `src/models/Artifact.js` — Artifact Model

```js
const mongoose = require("mongoose");

const artifactSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },

    name: { type: String, required: true },
    rarity: [Number],
    twoPieceBonus: String,
    fourPieceBonus: String,
    version: String,

    pieces: {
      flower: { name: String, relicType: String, description: String },
      plume: { name: String, relicType: String, description: String },
      sands: { name: String, relicType: String, description: String },
      goblet: { name: String, relicType: String, description: String },
      circlet: { name: String, relicType: String, description: String },
    },

    images: mongoose.Schema.Types.Mixed,
    url: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "artifacts" }
);

artifactSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Artifact", artifactSchema);
```

---

### `src/models/Material.js` — Material Model

```js
const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },
    sourceId: Number,

    name: { type: String, required: true },
    description: String,
    category: String,
    materialType: String,
    rarity: Number,
    source: [String],
    version: String,

    images: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "materials" }
);

materialSchema.index({ game: 1, name: 1 }, { unique: true });
materialSchema.index({ game: 1, category: 1 });

module.exports = mongoose.model("Material", materialSchema);
```

---

### `src/models/Talent.js` — Talent Model

```js
const mongoose = require("mongoose");

const talentSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },

    name: { type: String, required: true },
    combat1: mongoose.Schema.Types.Mixed,
    combat2: mongoose.Schema.Types.Mixed,
    combat3: mongoose.Schema.Types.Mixed,
    combatsp: mongoose.Schema.Types.Mixed,
    passive1: mongoose.Schema.Types.Mixed,
    passive2: mongoose.Schema.Types.Mixed,
    passive3: mongoose.Schema.Types.Mixed,
    passive4: mongoose.Schema.Types.Mixed,

    costs: mongoose.Schema.Types.Mixed,
    images: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "talents" }
);

talentSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Talent", talentSchema);
```

---

### `src/models/Constellation.js` — Constellation Model

```js
const mongoose = require("mongoose");

const constellationSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },

    name: { type: String, required: true },
    c1: { name: String, description: String },
    c2: { name: String, description: String },
    c3: { name: String, description: String },
    c4: { name: String, description: String },
    c5: { name: String, description: String },
    c6: { name: String, description: String },

    images: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "constellations" }
);

constellationSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Constellation", constellationSchema);
```

---

### `src/models/index.js` — Model Exports

```js
module.exports = {
  Character: require("./Character"),
  Weapon: require("./Weapon"),
  Artifact: require("./Artifact"),
  Material: require("./Material"),
  Talent: require("./Talent"),
  Constellation: require("./Constellation"),
};
```

---

### `src/middleware/queryBuilder.js` — Query Builder Middleware

```js
const NUMERIC_FIELDS = ["rarity", "sourceId", "baseAtkValue"];
const RESERVED_PARAMS = ["sort", "fields", "page", "limit", "search"];

function queryBuilder(Model) {
  return async (req, res, next) => {
    try {
      const filter = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (RESERVED_PARAMS.includes(key)) continue;
        if (NUMERIC_FIELDS.includes(key)) {
          filter[key] = Number(value);
        } else {
          filter[key] = value;
        }
      }

      if (req.query.search) {
        filter.name = { $regex: req.query.search, $options: "i" };
      }

      let query = Model.find(filter);

      if (req.query.sort) {
        const sortStr = req.query.sort.split(",").join(" ");
        query = query.sort(sortStr);
      } else {
        query = query.sort("name");
      }

      if (req.query.fields) {
        const fieldsStr = req.query.fields.split(",").join(" ");
        query = query.select(fieldsStr);
      }

      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
      const skip = (page - 1) * limit;

      const total = await Model.countDocuments(filter);
      query = query.skip(skip).limit(limit);

      const results = await query.lean();

      res.queryResult = {
        success: true,
        count: results.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        data: results,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = queryBuilder;
```

---

### `src/middleware/errorHandler.js` — Error Handler

```js
function errorHandler(err, req, res, _next) {
  console.error("Error:", err.message);

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, error: messages });
  }

  if (err.code === 11000) {
    return res.status(400).json({ success: false, error: "Duplicate entry" });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ success: false, error: "Invalid ID format" });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || "Internal server error",
  });
}

module.exports = errorHandler;
```

---

### `src/routes/resourceRouter.js` — Generic Route Factory

```js
const express = require("express");
const queryBuilder = require("../middleware/queryBuilder");

function createResourceRouter(Model, resourceName) {
  const router = express.Router();

  router.get("/", (req, res, next) => {
    if (req.gameParam) {
      req.query.game = req.gameParam;
    }
    next();
  }, queryBuilder(Model), (req, res) => {
    res.json(res.queryResult);
  });

  router.get("/:name", async (req, res, next) => {
    try {
      const filter = {
        name: { $regex: `^${req.params.name}$`, $options: "i" },
      };
      if (req.gameParam) filter.game = req.gameParam;

      const doc = await Model.findOne(filter).lean();
      if (!doc) {
        return res.status(404).json({
          success: false,
          error: `${resourceName} "${req.params.name}" not found`,
        });
      }
      res.json({ success: true, data: doc });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createResourceRouter;
```

---

### `src/routes/index.js` — Main API Router

```js
const express = require("express");
const router = express.Router();
const createResourceRouter = require("./resourceRouter");
const {
  Character, Weapon, Artifact, Material, Talent, Constellation,
} = require("../models");

const VALID_GAMES = ["genshin", "hsr", "zzz", "wuwa", "endfield"];

router.use("/:game", (req, res, next) => {
  const game = req.params.game.toLowerCase();
  if (!VALID_GAMES.includes(game)) {
    return res.status(400).json({
      success: false,
      error: `Invalid game "${req.params.game}". Valid: ${VALID_GAMES.join(", ")}`,
    });
  }
  req.gameParam = game;
  next();
});

router.use("/:game/characters", createResourceRouter(Character, "Character"));
router.use("/:game/weapons", createResourceRouter(Weapon, "Weapon"));
router.use("/:game/artifacts", createResourceRouter(Artifact, "Artifact"));
router.use("/:game/materials", createResourceRouter(Material, "Material"));
router.use("/:game/talents", createResourceRouter(Talent, "Talent"));
router.use("/:game/constellations", createResourceRouter(Constellation, "Constellation"));

router.get("/:game/stats", async (req, res, next) => {
  try {
    const game = req.gameParam;
    const [characters, weapons, artifacts, materials, talents, constellations] =
      await Promise.all([
        Character.countDocuments({ game }),
        Weapon.countDocuments({ game }),
        Artifact.countDocuments({ game }),
        Material.countDocuments({ game }),
        Talent.countDocuments({ game }),
        Constellation.countDocuments({ game }),
      ]);

    res.json({
      success: true,
      game,
      data: { characters, weapons, artifacts, materials, talents, constellations },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", (req, res) => {
  res.json({
    name: "Gacha DB API",
    version: "1.0.0",
    games: VALID_GAMES,
    endpoints: VALID_GAMES.map((g) => ({
      game: g,
      routes: [
        `GET /api/${g}/characters`,
        `GET /api/${g}/characters/:name`,
        `GET /api/${g}/weapons`,
        `GET /api/${g}/weapons/:name`,
        `GET /api/${g}/artifacts`,
        `GET /api/${g}/artifacts/:name`,
        `GET /api/${g}/materials`,
        `GET /api/${g}/materials/:name`,
        `GET /api/${g}/talents`,
        `GET /api/${g}/talents/:name`,
        `GET /api/${g}/constellations`,
        `GET /api/${g}/constellations/:name`,
        `GET /api/${g}/stats`,
      ],
    })),
    queryParams: {
      filtering: "?element=Pyro&rarity=5&region=Liyue",
      search: "?search=hu (case-insensitive name search)",
      sort: "?sort=name,-rarity (prefix - for descending)",
      fields: "?fields=name,element,rarity (select specific fields)",
      pagination: "?page=1&limit=20 (default: 25, max: 100)",
    },
  });
});

module.exports = router;
```

---

### `src/scripts/seedGenshin.js` — Genshin Data Seeder

```js
require("dotenv").config();
const mongoose = require("mongoose");
const genshindb = require("genshin-db");
const connectDB = require("../config/db");
const {
  Character, Weapon, Artifact, Material, Talent, Constellation,
} = require("../models");

const GAME = "genshin";
const forceOverwrite = process.argv.includes("--force");

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
      refinements: data.refinements,
      costs: data.costs,
      images: data.images,
      url: data.url,
    });
    count++;
  }
  console.log(`  ✓ Seeded ${count} weapons`);
}

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
```

---

### `src/server.js` — Express App Entry Point

```js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const apiRoutes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.use("/api", apiRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found. Visit GET /api for available endpoints.`,
  });
});

app.use(errorHandler);

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n🎮 Gacha DB API running on http://localhost:${PORT}`);
    console.log(`📖 API docs at http://localhost:${PORT}/api\n`);
  });
}

start();
```

---

## Running the Project

After creating all files above:

```bash
# 1. Seed the database with Genshin data
npm run seed:genshin

# 2. Start the dev server
npm run dev
```

## Test Endpoints

```
GET http://localhost:5000/api                                    → API info
GET http://localhost:5000/api/genshin/stats                      → collection counts
GET http://localhost:5000/api/genshin/characters                 → all characters
GET http://localhost:5000/api/genshin/characters?rarity=5&element=Pyro → filtered
GET http://localhost:5000/api/genshin/characters/Hu Tao          → single character
GET http://localhost:5000/api/genshin/weapons?search=homa        → search weapons
GET http://localhost:5000/api/genshin/artifacts                  → all artifact sets
GET http://localhost:5000/api/genshin/materials?page=2&limit=10  → paginated
```

## Updating After a Genshin Patch

```bash
npm update genshin-db
npm run seed:genshin
```

---

## Architecture Notes for Future Development

- **Adding a new game**: Create a new seed script (e.g. `src/scripts/seedHSR.js`). All models already support multi-game via the `game` field. Routes work automatically.
- **Frontend**: Build a React app that consumes this API. The CORS middleware is already enabled.
- **Deployment**: Backend on Render/Railway, MongoDB on Atlas free tier, frontend on Vercel.
- **Data sources for other games**: HSR → Yatta.moe API, ZZZ → Dimbreath/ZenlessData, WuWa → Dimbreath/WutheringData, Endfield → community sources TBD.
