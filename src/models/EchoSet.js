const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

/**
 * WuWa Echo Set (Sonata Effect) — equivalent to Genshin Artifact Sets and HSR Relic Sets.
 *
 * Unlike Genshin (2/4-piece) and HSR (2-piece each), WuWa sets activate at:
 *   2-piece: minor bonus (e.g. +10% Glacio DMG)
 *   5-piece: major bonus (e.g. after Glacio skill, next Glacio DMG +100% for 15s)
 *
 * Some later sets use 3-piece (or 1-piece) bonuses instead.
 * The list is synchronised from the game data (see src/scripts/seedWuwa.js).
 */

const echoSetSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: GAME_IDS,
      index: true,
    },

    sourceId: String, // game internal ID

    name: { type: String, required: true }, // e.g. "Freezing Frost"
    description: String, // optional flavor text

    // Sonata effects. Most sets are 2+5-piece; newer ones are 3-piece only,
    // and a few special sets activate with a single echo.
    onePieceBonus: String,
    twoPieceBonus: String,
    threePieceBonus: String,
    fivePieceBonus: String,

    // Primary element/theme association (for color coding and filtering)
    element: { type: String, index: true }, // e.g. "Glacio" for Freezing Frost

    images: mongoose.Schema.Types.Mixed, // { icon: String }
  },
  { timestamps: true, collection: "echosets" }
);

echoSetSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("EchoSet", echoSetSchema);
