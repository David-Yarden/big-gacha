const mongoose = require("mongoose");

const lightConeSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },
    sourceId: Number, // 5-digit internal game ID (e.g. 23000)

    name: { type: String, required: true },
    description: String,
    path: { type: String, index: true }, // "The Hunt", "Destruction", etc.
    rarity: { type: Number, index: true }, // 3, 4, or 5

    // Passive effect
    effectName: String,         // skill name from light_cone_ranks
    effectTemplateRaw: String,  // desc string with #1[i]% placeholders

    version: String,

    // Pre-computed stats for every level 1–80
    // { "1": { hp, atk, def }, ..., "80": { hp, atk, def } }
    stats: mongoose.Schema.Types.Mixed,

    // S1–S5 superimposition data
    // [{ description: string, values: string[] }] × 5
    superimpositions: [mongoose.Schema.Types.Mixed],

    // Ascension material costs
    // { ascend1: [{id, name, count}], …, ascend6: [...] }
    costs: mongoose.Schema.Types.Mixed,

    // image/preview/portrait paths (resolved to full CDN URLs at seed time)
    images: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "lightcones" }
);

lightConeSchema.index({ game: 1, name: 1 }, { unique: true });
lightConeSchema.index({ game: 1, path: 1 });
lightConeSchema.index({ game: 1, rarity: 1 });

module.exports = mongoose.model("LightCone", lightConeSchema);
