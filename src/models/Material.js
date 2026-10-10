const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

const materialSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: GAME_IDS,
      index: true,
    },
    sourceId: Number,

    name: { type: String, required: true },
    description: String,
    category: String,
    materialType: String,
    rarity: Number,
    source: [String],
    // Genshin: the domain that drops it and its days (1 = Monday … 7 = Sunday)
    domain: String,
    days: [Number],
    version: String,

    images: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "materials" }
);

materialSchema.index({ game: 1, name: 1 }, { unique: true });
materialSchema.index({ game: 1, category: 1 });

module.exports = mongoose.model("Material", materialSchema);
