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
} = require("../models");

// Valid games
const VALID_GAMES = ["genshin", "hsr", "zzz", "wuwa", "endfield"];

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

// ─── Mount resource routes ───────────────────────────────

router.use("/:game/characters", createResourceRouter(Character, "Character"));
router.use("/:game/weapons", createResourceRouter(Weapon, "Weapon"));
router.use("/:game/artifacts", createResourceRouter(Artifact, "Artifact"));
router.use("/:game/materials", createResourceRouter(Material, "Material"));
router.use("/:game/talents", createResourceRouter(Talent, "Talent"));
router.use("/:game/constellations", createResourceRouter(Constellation, "Constellation"));

// ─── Stats endpoint ──────────────────────────────────────
// Returns counts per collection for a given game

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

// ─── Root info ───────────────────────────────────────────

router.get("/", (req, res) => {
  res.json({
    name: "Big Gacha API",
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
