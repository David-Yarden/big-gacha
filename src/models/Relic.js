const mongoose = require("mongoose");

const relicSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },
    sourceId: Number, // numeric set ID (e.g. 101)

    name: { type: String, required: true }, // set name
    type: { type: String, index: true },    // "cavern" | "planar"
    rarity: [Number],                        // [2,3,4,5] or [5]

    twoPieceBonus: String,
    fourPieceBonus: String, // null for Planar Ornaments (2-piece only sets)

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
