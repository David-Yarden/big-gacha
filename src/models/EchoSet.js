const mongoose = require("mongoose");

/**
 * WuWa Echo Set (Sonata Effect) — equivalent to Genshin Artifact Sets and HSR Relic Sets.
 *
 * Unlike Genshin (2/4-piece) and HSR (2-piece each), WuWa sets activate at:
 *   2-piece: minor bonus (e.g. +10% Glacio DMG)
 *   5-piece: major bonus (e.g. after Glacio skill, next Glacio DMG +100% for 15s)
 *
 * Known sets (as of v3.1):
 *   Freezing Frost, Molten Rift, Void Thunder, Sierra Gale,
 *   Celestial Light, Sun-Sinking Eclipse, Lingering Tunes,
 *   Rejuvenating Glow, Moonlit Clouds, Tidebreaking Courage
 */

const echoSetSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },

    sourceId: String, // game internal ID

    name: { type: String, required: true }, // e.g. "Freezing Frost"
    description: String, // optional flavor text

    twoPieceBonus: String,  // 2-piece sonata effect description
    fivePieceBonus: String, // 5-piece sonata effect description

    // Primary element/theme association (for color coding and filtering)
    element: { type: String, index: true }, // e.g. "Glacio" for Freezing Frost

    images: mongoose.Schema.Types.Mixed, // { icon: String }
  },
  { timestamps: true, collection: "echosets" }
);

echoSetSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("EchoSet", echoSetSchema);
