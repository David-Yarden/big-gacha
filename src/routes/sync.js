/**
 * /api/sync — status, manual runs, rollback and the changelog.
 */
const express = require("express");
const { runSync, runAll, rollback, isRunning, ADAPTERS } = require("../sync/engine");
const { SyncState, Changelog } = require("../models");
const { games } = require("../../shared/games");

const router = express.Router();

const flag = (v) => v === "1" || v === "true";

// GET /api/sync/status — one entry per game
router.get("/status", async (req, res, next) => {
  try {
    const states = await SyncState.find().lean();
    const byGame = Object.fromEntries(states.map((s) => [s.game, s]));
    res.json({
      success: true,
      running: isRunning(),
      scheduler: require("../sync/scheduler").schedulerInfo(),
      unseen: states.some((s) => s.unseen),
      data: games
        .filter((g) => g.available)
        .map((g) => ({
          game: g.id,
          name: g.name,
          syncable: !!ADAPTERS[g.id],
          source: ADAPTERS[g.id]?.source ?? null,
          ...(byGame[g.id] || {}),
        })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sync/changelog?game=hsr&limit=20
router.get("/changelog", async (req, res, next) => {
  try {
    const filter = {};
    if (typeof req.query.game === "string" && ADAPTERS[req.query.game]) filter.game = req.query.game;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const data = await Changelog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/sync/seen — the user opened the Updates page
router.post("/seen", async (req, res, next) => {
  try {
    await SyncState.updateMany({}, { $set: { unseen: false } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/sync/all?dryRun=1&force=1
router.post("/all", async (req, res, next) => {
  try {
    res.json({ success: true, data: await runAll({ dryRun: flag(req.query.dryRun), force: flag(req.query.force) }) });
  } catch (err) {
    next(err);
  }
});

// POST /api/sync/:game?dryRun=1&force=1
router.post("/:game", async (req, res, next) => {
  try {
    const data = await runSync(req.params.game, { dryRun: flag(req.query.dryRun), force: flag(req.query.force), prune: flag(req.query.prune), resetVersions: flag(req.query.resetVersions) });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/sync/:game/rollback
router.post("/:game/rollback", async (req, res, next) => {
  try {
    res.json({ success: true, data: await rollback(req.params.game) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
