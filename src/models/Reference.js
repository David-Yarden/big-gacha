const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

/**
 * Game-wide reference tables that belong to no single entity
 * (e.g. ZZZ "Drive Disc stats": main stats per slot and substats).
 */
const referenceSchema = new mongoose.Schema(
  {
    game: { type: String, required: true, enum: GAME_IDS, index: true },
    name: { type: String, required: true },
    data: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "references" }
);

referenceSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Reference", referenceSchema);
