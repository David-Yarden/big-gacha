/**
 * Decks of the deck builder (one list per game).
 *   GET    /api/:game/decks          → [{ _id, name, team, count, updatedAt }]
 *   GET    /api/:game/decks/:id      → the deck
 *   POST   /api/:game/decks          → creates it (body: { name, team, cards, notes })
 *   PUT    /api/:game/decks/:id      → replaces it
 *   DELETE /api/:game/decks/:id
 * Writes need the X-Big-Gacha header like every action (src/server.js).
 */

const str = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

/** Only the known fields, as plain strings and numbers (no operator can get through). */
function clean(body) {
  const b = body && typeof body === "object" ? body : {};
  const cards = (Array.isArray(b.cards) ? b.cards : []).slice(0, 150).flatMap((c) => {
    if (!c || typeof c !== "object") return [];
    const uid = str(c.uid, 40);
    const cardId = str(c.cardId, 80);
    const source = c.source === "kit" || c.source === "extra" ? c.source : undefined;
    if (!uid || !cardId || !source) return [];
    return [
      {
        uid,
        source,
        cardId,
        owner: str(c.owner, 80),
        level: Math.min(9, Math.max(0, Math.floor(Number(c.level) || 0))),
        divineId: str(c.divineId, 80),
        commonId: str(c.commonId, 80),
        engravings: Array.isArray(c.engravings) ? c.engravings.slice(0, 2).map((e) => str(e, 80) ?? "") : undefined,
        personaClass: str(c.personaClass, 40),
      },
    ];
  });
  return {
    name: str(b.name, 80) ?? "New deck",
    team: (Array.isArray(b.team) ? b.team : []).map((t) => str(t, 80)).filter(Boolean).slice(0, 3),
    cards,
    notes: str(b.notes, 2000) ?? "",
  };
}

module.exports = function deckRoutes(router) {
  // Required here so that clean() can be tested without a database
  const express = require("express");
  const mongoose = require("mongoose");
  const Deck = require("../models/Deck");
  const validId = (id) => mongoose.isValidObjectId(id);

  router.get("/:game/decks", async (req, res, next) => {
    try {
      const decks = await Deck.find({ deckGame: req.gameParam }).sort({ updatedAt: -1 }).select("name team cards updatedAt").lean();
      res.json({ success: true, data: decks.map(({ cards, ...d }) => ({ ...d, count: cards?.length ?? 0 })) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:game/decks/:id", async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ success: false, error: "Deck not found" });
      const deck = await Deck.findOne({ _id: req.params.id, deckGame: req.gameParam }).lean();
      if (!deck) return res.status(404).json({ success: false, error: "Deck not found" });
      res.json({ success: true, data: deck });
    } catch (err) {
      next(err);
    }
  });

  router.post("/:game/decks", express.json({ limit: "1mb" }), async (req, res, next) => {
    try {
      const deck = await Deck.create({ deckGame: req.gameParam, ...clean(req.body) });
      res.status(201).json({ success: true, data: deck.toObject() });
    } catch (err) {
      next(err);
    }
  });

  router.put("/:game/decks/:id", express.json({ limit: "1mb" }), async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ success: false, error: "Deck not found" });
      const deck = await Deck.findOneAndUpdate({ _id: req.params.id, deckGame: req.gameParam }, clean(req.body), {
        new: true,
        runValidators: true,
      }).lean();
      if (!deck) return res.status(404).json({ success: false, error: "Deck not found" });
      res.json({ success: true, data: deck });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:game/decks/:id", async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return res.status(404).json({ success: false, error: "Deck not found" });
      await Deck.deleteOne({ _id: req.params.id, deckGame: req.gameParam });
      res.json({ success: true, data: { deleted: true } });
    } catch (err) {
      next(err);
    }
  });
};

module.exports.clean = clean;
