const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

/**
 * Farm plan of a game: characters with their current and target levels, and the
 * materials already owned. One plan per game. The game is stored as `planGame` (not
 * `game`) so that the sync's backups and rollbacks of game data never touch it.
 */
const planSchema = new mongoose.Schema(
  {
    planGame: { type: String, required: true, enum: GAME_IDS, unique: true },
    entries: [
      {
        _id: false,
        character: { type: String, required: true }, // English name
        levelFrom: { type: Number, default: 1 },
        levelTo: { type: Number, default: 90 },
        skillFrom: { type: Number, default: 1 },
        skillTo: { type: Number, default: 10 },
        weapon: String, // English name, optional
        weaponFrom: { type: Number, default: 1 },
        weaponTo: { type: Number, default: 90 },
        nodes: { type: Boolean, default: true }, // count the one-time trace / stat nodes
      },
    ],
    // In-game UID, to import the showcase levels again (Enka.Network)
    uid: String,
    // Material key (id, or name when there is none) → count owned
    inventory: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: "plans" }
);

module.exports = mongoose.model("Plan", planSchema);
