/**
 * GET /api/search?q=…[&game=…] — one search box for every game and resource.
 * Returns the best matches first: exact name, then names starting with the query,
 * then names containing it.
 */
const express = require("express");
const { Character, Weapon, Artifact, Material, LightCone, Relic, Echo, EchoSet, Bangboo } = require("../models");
const { escapeRegex } = require("../utils/query");
const { GAME_IDS } = require("../../shared/games");

const router = express.Router();

// [model, URL segment, label] — the segment is the page path under /:game/
const SOURCES = [
  [Character, "characters", "Character"],
  [Weapon, "weapons", "Weapon"],
  [LightCone, "lightcones", "Light Cone"],
  [Artifact, "artifacts", "Artifact Set"],
  [Relic, "relics", "Relic Set"],
  [EchoSet, "echosets", "Sonata Effect"],
  [Echo, "echoes", "Echo"],
  [Bangboo, "bangboos", "Bangboo"],
  [Material, "materials", "Material"],
];

// Names a game uses for a shared collection
const GAME_LABELS = { zzz: { characters: "Agent", weapons: "W-Engine", relics: "Drive Disc" } };

router.get("/", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 60);
    if (q.length < 2) return res.json({ success: true, data: [] });
    const games = GAME_IDS.includes(req.query.game) ? [req.query.game] : GAME_IDS;
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit) || 20));
    const re = new RegExp(escapeRegex(q), "i");
    const lower = q.toLowerCase();

    const lists = await Promise.all(
      SOURCES.map(([Model, type, label]) =>
        Model.find({ game: { $in: games }, $or: [{ name: re }, { "i18n.fr.name": re }] })
          .select("game name rarity element path weaponType images i18n.fr.name")
          .limit(limit)
          .lean()
          .then((docs) => docs.map((d) => ({ ...d, type, label: GAME_LABELS[d.game]?.[type] ?? label })))
      )
    );

    const score = (r) => {
      const n = (re.test(r.name) ? r.name : r.i18n?.fr?.name ?? r.name).toLowerCase();
      const base = n === lower ? 0 : n.startsWith(lower) ? 1 : /\b/.test(n) && n.includes(` ${lower}`) ? 2 : 3;
      // Characters first, materials last, within the same match quality
      return base * 10 + SOURCES.findIndex((s) => s[1] === r.type);
    };
    const data = lists
      .flat()
      .sort((a, b) => score(a) - score(b) || a.name.length - b.name.length)
      .slice(0, limit)
      .map(({ _id, ...r }) => r);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
