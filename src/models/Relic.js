const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

const relicSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: GAME_IDS,
      index: true,
    },
    sourceId: Number, // numeric set ID (e.g. 101)

    name: { type: String, required: true }, // set name
    type: { type: String, index: true },    // "cavern" | "planar"
    rarity: [Number],                        // [2,3,4,5] or [5]

    twoPieceBonus: String,
    fourPieceBonus: String, // null for Planar Ornaments (2-piece only sets)
    description: String, // set story (ZZZ Drive Discs)
    // Endfield gear sets: one bonus for N pieces, and the pieces of every tier
    setPieces: Number,
    setBonus: String,
    items: [mongoose.Schema.Types.Mixed], // [{ name, slot, rarity, icon, level }]

    version: String,

    // Individual piece descriptions
    // Cavern Relics use: head, hands, body, feet
    // Planar Ornaments use: sphere, rope
    pieces: {
      head:   { name: String, description: String, icon: String },
      hands:  { name: String, description: String, icon: String },
      body:   { name: String, description: String, icon: String },
      feet:   { name: String, description: String, icon: String },
      sphere: { name: String, description: String, icon: String },
      rope:   { name: String, description: String, icon: String },
    },

    // Set icon path (resolved to full CDN URL at seed time)
    images: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "relics" }
);

relicSchema.index({ game: 1, name: 1 }, { unique: true });
relicSchema.index({ game: 1, type: 1 });

module.exports = mongoose.model("Relic", relicSchema);
