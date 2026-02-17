const mongoose = require("mongoose");

const artifactSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },

    name: { type: String, required: true },
    rarity: [Number],
    twoPieceBonus: String,
    fourPieceBonus: String,
    version: String,

    pieces: {
      flower: { name: String, relicType: String, description: String },
      plume: { name: String, relicType: String, description: String },
      sands: { name: String, relicType: String, description: String },
      goblet: { name: String, relicType: String, description: String },
      circlet: { name: String, relicType: String, description: String },
    },

    images: mongoose.Schema.Types.Mixed,
    url: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "artifacts" }
);

artifactSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Artifact", artifactSchema);
