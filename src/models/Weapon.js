const mongoose = require("mongoose");

const weaponSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },
    sourceId: Number,

    name: { type: String, required: true },
    description: String,
    weaponType: { type: String, index: true },
    rarity: { type: Number, index: true },
    baseAtkValue: Number,
    mainStatType: String,
    mainStatText: String,
    baseStatText: String,
    effectName: String,
    effectTemplateRaw: String,
    version: String,

    stats: mongoose.Schema.Types.Mixed, // { "1": {atk, specialized}, ..., "90": {...} }
    refinements: [mongoose.Schema.Types.Mixed],
    costs: mongoose.Schema.Types.Mixed,
    images: mongoose.Schema.Types.Mixed,
    url: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "weapons" }
);

weaponSchema.index({ game: 1, name: 1 }, { unique: true });
weaponSchema.index({ game: 1, weaponType: 1 });
weaponSchema.index({ game: 1, rarity: 1 });

module.exports = mongoose.model("Weapon", weaponSchema);
