const express = require("express");
const router = express.Router();
const createResourceRouter = require("./resourceRouter");
const {
  Character,
  Weapon,
  Artifact,
  Material,
  Talent,
  Constellation,
  LightCone,
  Relic,
  Trace,
  Eidolon,
  Forte,
  ResonanceChain,
  Echo,
  EchoSet,
  AgentKit,
  Bangboo,
  Reference,
} = require("../models");

const { games, GAME_IDS } = require("../../shared/games");

// Valid games come from the shared registry (shared/games.json)
const VALID_GAMES = GAME_IDS;

// ─── Game param middleware ────────────────────────────────
// Validates the :game param and attaches it to the request

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

/** English name of a document from its English or translated (French) name */
async function englishName(Model, game, name) {
  if (!name) return name;
  if (await Model.exists({ game, name })) return name;
  const doc = await Model.findOne({ game, "i18n.fr.name": name }).select("name").lean();
  return doc?.name ?? name;
}

// ─── Kit enhancements of a game ──────────────────────────
// GET /api/:game/enhancements?character=Kafka → { types, entries }
const { Enhancement, EnhancementType } = require("../models");
router.get("/:game/enhancements", async (req, res, next) => {
  try {
    const game = req.gameParam;
    const entryFilter = { game };
    if (typeof req.query.character === "string") req.query.character = await englishName(Character, game, req.query.character);
    if (typeof req.query.character === "string") entryFilter.character = req.query.character;
    const [types, entries] = await Promise.all([
      EnhancementType.find({ game }).sort({ version: 1, name: 1 }).lean(),
      Enhancement.find(entryFilter).sort({ type: 1, order: 1 }).lean(),
    ]);
    const character = typeof req.query.character === "string" ? req.query.character : null;
    res.json({
      success: true,
      data: {
        types: character ? types.filter((t) => t.characters?.includes(character)) : types,
        entries,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Farm plan ───────────────────────────────────────────
// GET /api/:game/plan → { entries, inventory }   PUT (same body) saves it
router.get("/:game/plan", async (req, res, next) => {
  try {
    const { Plan } = require("../models");
    const plan = await Plan.findOne({ planGame: req.gameParam }).lean();
    res.json({ success: true, data: { entries: plan?.entries ?? [], inventory: plan?.inventory ?? {}, uid: plan?.uid } });
  } catch (err) {
    next(err);
  }
});
router.put("/:game/plan", express.json({ limit: "1mb" }), async (req, res, next) => {
  try {
    const { Plan } = require("../models");
    const body = req.body || {};
    const entries = Array.isArray(body.entries) ? body.entries.slice(0, 200) : [];
    const uid = /^\d{9,10}$/.test(String(body.uid || "")) ? String(body.uid) : undefined;
    const inventory = {};
    for (const [k, v] of Object.entries(body.inventory && typeof body.inventory === "object" ? body.inventory : {})) {
      const n = Math.max(0, Math.floor(Number(v) || 0));
      if (n > 0 && k.length < 120) inventory[k] = n;
    }
    const doc = await Plan.findOneAndUpdate(
      { planGame: req.gameParam },
      body.uid === "" ? { planGame: req.gameParam, entries, inventory, $unset: { uid: 1 } } : { planGame: req.gameParam, entries, inventory, uid },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    res.json({ success: true, data: { entries: doc.entries, inventory: doc.inventory, uid: doc.uid } });
  } catch (err) {
    next(err);
  }
});

// ─── Decks of the deck builder ───────────────────────────
require("./decks")(router);

// ─── Player showcase (Enka.Network) ──────────────────────
// GET /api/:game/account/:uid → { nickname, characters: [{ character, level, skill, weapon, weaponLevel }] }
router.get("/:game/account/:uid", async (req, res) => {
  try {
    const data = await require("../sync/account").showcase(req.gameParam, String(req.params.uid));
    const fr = req.query.lang === "fr";
    const characters = data.characters.map(({ frName, ...c }) => ({ ...c, displayName: (fr && frName) || c.character }));
    res.json({ success: true, data: { ...data, characters }, source: "Enka.Network" });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// ─── In-game events (official announcements, live) ──────
// GET /api/:game/events?lang=fr → { source, events: [{ id, title, start, end, image }] }
router.get("/:game/events", async (req, res) => {
  try {
    const data = await require("../sync/events").gameEvents(req.gameParam, req.query.lang === "fr" ? "fr" : "en");
    if (!data) return res.json({ success: true, data: null });
    res.json({ success: true, data });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
});

// ─── Where to farm ───────────────────────────────────────
// GET /api/:game/farm?names=A|B → [{ name, rarity, source, domain, days, images, i18n? }]
// (the planner's "Where to farm": English or French names)
router.get("/:game/farm", async (req, res, next) => {
  try {
    const { Material } = require("../models");
    const names = String(req.query.names || "").split("|").map((x) => x.trim()).filter(Boolean).slice(0, 300);
    if (!names.length) return res.json({ success: true, data: [] });
    const fr = req.query.lang === "fr";
    const docs = await Material.find({ game: req.gameParam, $or: [{ name: { $in: names } }, { "i18n.fr.name": { $in: names } }] })
      .select(`name sourceId rarity source domain days images${fr ? " i18n" : ""}`)
      .lean();
    res.json({ success: true, data: docs });
  } catch (err) {
    next(err);
  }
});

// ─── Banner history ──────────────────────────────────────
// GET /api/:game/banners → { source, banners: newest first, units: { name: { kind, rarity, element, images } } }
//   ?unit=Kafka&kind=character — only the banners featuring that character (or weapon)
router.get("/:game/banners", async (req, res, next) => {
  try {
    const game = req.gameParam;
    const { Banner } = require("../models");
    const filter = { game };
    if (typeof req.query.unit === "string") {
      const unit = await englishName(req.query.kind === "weapon" ? (game === "hsr" ? LightCone : Weapon) : Character, game, req.query.unit);
      filter.featured = { $elemMatch: { name: unit, ...(req.query.kind === "weapon" || req.query.kind === "character" ? { kind: req.query.kind } : {}) } };
    }
    const banners = await Banner.find(filter).sort({ start: -1, name: 1 }).select("-_id -__v -createdAt -updatedAt -game").lean();
    const names = { character: new Set(), weapon: new Set() };
    for (const b of banners) for (const f of b.featured || []) names[f.kind === "weapon" ? "weapon" : "character"].add(f.name);
    const WeaponModel = game === "hsr" ? LightCone : Weapon;
    const [chars, weapons] = await Promise.all([
      Character.find({ game, name: { $in: [...names.character] } }).select("name rarity element images i18n.fr.name").lean(),
      WeaponModel.find({ game, name: { $in: [...names.weapon] } }).select("name rarity images i18n.fr.name").lean(),
    ]);
    const units = {};
    for (const c of chars) units[`character:${c.name}`] = { rarity: c.rarity, element: c.element, images: c.images, i18n: c.i18n };
    for (const w of weapons) units[`weapon:${w.name}`] = { rarity: w.rarity, images: w.images, i18n: w.i18n };
    res.json({ success: true, data: { source: banners[0]?.source ?? null, banners, units } });
  } catch (err) {
    next(err);
  }
});

// ─── What each version added ─────────────────────────────
// GET /api/:game/versions → [{ version, groups: [{ type, items: [{ name, rarity, element, images }] }] }]
// newest first; only entities whose release version is known.
const VERSIONED = [
  [Character, "characters"],
  [Weapon, "weapons"],
  [LightCone, "lightcones"],
  [Artifact, "artifacts"],
  [Relic, "relics"],
  [Bangboo, "bangboos"],
];
const rarityOf = (d) => (typeof d.rarity === "number" ? d.rarity : Array.isArray(d.rarity) ? Math.max(...d.rarity) : 0);
function versionKey(v) {
  // CZN has release dates instead of versions: they already sort as text
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return String(v);
  return String(v)
    .split(".")
    .map((n) => String(Number(n) || 0).padStart(4, "0"))
    .join(".");
}
router.get("/:game/versions", async (req, res, next) => {
  try {
    const game = req.gameParam;
    const lists = await Promise.all(
      VERSIONED.map(([M, type]) =>
        M.find({ game, version: { $nin: [null, ""] } })
          .select("name rarity element subElement path weaponType specialty type version images i18n.fr.name")
          .lean()
          .then((docs) => docs.map((d) => ({ ...d, _type: type })))
      )
    );
    const byVersion = new Map();
    for (const d of lists.flat()) {
      const v = String(d.version);
      if (!byVersion.has(v)) byVersion.set(v, new Map());
      const groups = byVersion.get(v);
      if (!groups.has(d._type)) groups.set(d._type, []);
      const { _id, _type, version, ...item } = d;
      groups.get(d._type).push(item);
    }
    const data = [...byVersion]
      .sort((a, b) => versionKey(b[0]).localeCompare(versionKey(a[0])))
      .map(([version, groups]) => ({
        version,
        groups: VERSIONED.filter(([, type]) => groups.has(type)).map(([, type]) => ({
          type,
          items: groups.get(type).sort((a, b) => rarityOf(b) - rarityOf(a) || a.name.localeCompare(b.name)),
        })),
      }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── Who uses a material ─────────────────────────────────
// GET /api/:game/materials/:name/usage → [{ type, name, rarity, images }]
// Costs are stored per game in different shapes; any array of { name } entries inside a
// document's costs counts.
function costsMention(costs, name) {
  if (!costs || typeof costs !== "object") return false;
  if (Array.isArray(costs)) return costs.some((c) => (c && c.name === name) || costsMention(c, name));
  return Object.values(costs).some((v) => costsMention(v, name));
}
router.get("/:game/materials/:name/usage", async (req, res, next) => {
  try {
    const game = req.gameParam;
    const name = await englishName(Material, game, req.params.name);
    const kits = [Talent, Trace, Forte, AgentKit]; // keyed by character name
    const [chars, weapons, cones, ...kitDocs] = await Promise.all([
      Character.find({ game }).select("name rarity images costs elementVariants i18n.fr.name").lean(),
      Weapon.find({ game }).select("name rarity images costs i18n.fr.name").lean(),
      LightCone.find({ game }).select("name rarity images costs i18n.fr.name").lean(),
      ...kits.map((M) => M.find({ game }).select("name costs elementVariants").lean()),
    ]);
    const kitUsers = new Set(kitDocs.flat().filter((k) => costsMention(k.costs, name) || costsMention(k.elementVariants, name)).map((k) => k.name));
    const pick = (type) => (d) => ({ type, name: d.name, rarity: d.rarity, images: d.images, i18n: d.i18n });
    const data = [
      ...chars.filter((c) => kitUsers.has(c.name) || costsMention(c.costs, name) || costsMention(c.elementVariants, name)).map(pick("characters")),
      ...weapons.filter((w) => costsMention(w.costs, name)).map(pick("weapons")),
      ...cones.filter((w) => costsMention(w.costs, name)).map(pick("lightcones")),
    ];
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── Mount resource routes ───────────────────────────────

// Genshin
router.use("/:game/characters", createResourceRouter(Character, "Character"));
router.use("/:game/weapons", createResourceRouter(Weapon, "Weapon"));
router.use("/:game/artifacts", createResourceRouter(Artifact, "Artifact"));
router.use("/:game/materials", createResourceRouter(Material, "Material"));
router.use("/:game/talents", createResourceRouter(Talent, "Talent"));
router.use("/:game/constellations", createResourceRouter(Constellation, "Constellation"));

// HSR
router.use("/:game/lightcones", createResourceRouter(LightCone, "Light Cone"));
router.use("/:game/relics", createResourceRouter(Relic, "Relic"));
router.use("/:game/traces", createResourceRouter(Trace, "Trace"));
router.use("/:game/eidolons", createResourceRouter(Eidolon, "Eidolon"));

// WuWa
router.use("/:game/fortes", createResourceRouter(Forte, "Forte"));
router.use("/:game/resonancechains", createResourceRouter(ResonanceChain, "Resonance Chain"));
router.use("/:game/echoes", createResourceRouter(Echo, "Echo"));
router.use("/:game/echosets", createResourceRouter(EchoSet, "Echo Set"));

// ZZZ (W-Engines use /weapons, Drive Discs use /relics)
router.use("/:game/agentkits", createResourceRouter(AgentKit, "Agent kit"));
router.use("/:game/bangboos", createResourceRouter(Bangboo, "Bangboo"));
router.use("/:game/references", createResourceRouter(Reference, "Reference"));

// ─── Stats endpoint ──────────────────────────────────────
// Returns counts per collection for a given game

router.get("/:game/stats", async (req, res, next) => {
  try {
    const game = req.gameParam;
    const [
      characters,
      weapons,
      artifacts,
      materials,
      talents,
      constellations,
      lightCones,
      relics,
      traces,
      eidolons,
      fortes,
      resonanceChains,
      echoes,
      echoSets,
    ] = await Promise.all([
      Character.countDocuments({ game }),
      Weapon.countDocuments({ game }),
      Artifact.countDocuments({ game }),
      Material.countDocuments({ game }),
      Talent.countDocuments({ game }),
      Constellation.countDocuments({ game }),
      LightCone.countDocuments({ game }),
      Relic.countDocuments({ game }),
      Trace.countDocuments({ game }),
      Eidolon.countDocuments({ game }),
      Forte.countDocuments({ game }),
      ResonanceChain.countDocuments({ game }),
      Echo.countDocuments({ game }),
      EchoSet.countDocuments({ game }),
    ]);

    res.json({
      success: true,
      game,
      data: {
        characters,
        weapons,
        artifacts,
        materials,
        talents,
        constellations,
        lightCones,
        relics,
        traces,
        eidolons,
        fortes,
        resonanceChains,
        echoes,
        echoSets,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── Root info ───────────────────────────────────────────

router.get("/", (req, res) => {
  res.json({
    name: "Big Gacha API",
    version: "1.1.0",
    games: VALID_GAMES,
    endpoints: games.map((g) => ({
      game: g.id,
      available: g.available,
      routes: [
        ...g.resources.flatMap((r) => [`GET /api/${g.id}/${r.path}`, `GET /api/${g.id}/${r.path}/:name`]),
        `GET /api/${g.id}/stats`,
      ],
    })),
    queryParams: {
      filtering: "?element=Fire&rarity=5&path=Destruction (any scalar field; unknown fields are ignored)",
      search: "?search=march (case-insensitive name search)",
      sort: "?sort=name,-rarity (prefix - for descending)",
      fields: "?fields=name,element,rarity (select specific fields)",
      pagination: "?page=1&limit=20 (default: 25, max: 100)",
    },
  });
});

module.exports = router;
