const mongoose = require("mongoose");

const characterSchema = new mongoose.Schema(
  {
    // === Meta ===
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },
    sourceId: { type: Number }, // original game id (e.g. 10000046 for Hu Tao)

    // === Core Info ===
    name: { type: String, required: true },
    title: String, // "Fragrance in Thaw"
    description: String,
    rarity: { type: Number, index: true }, // 4 or 5
    element: { type: String, index: true }, // "Pyro", "Anemo", etc.
    elementType: String, // raw enum "ELEMENT_PYRO"
    weaponType: { type: String, index: true }, // "Polearm", "Sword", etc. (Genshin)
    weaponTypeRaw: String, // raw enum "WEAPON_POLE"
    path: { type: String, index: true }, // "The Hunt", "Destruction", etc. (HSR)
    bodyType: String, // "BODY_GIRL", "BODY_BOY", etc.
    gender: String, // "Female", "Male"
    region: String, // "Liyue", "Mondstadt", etc.
    affiliation: String, // "Wangsheng Funeral Parlor"
    associationType: String, // "ASSOC_LIYUE"

    // === Details ===
    birthday: String, // "July 15"
    birthdaymmdd: String, // "7/15"
    constellation: String, // "Papilio Charontis"
    substatType: String, // "FIGHT_PROP_CRITICAL_HURT"
    substatText: String, // "CRIT DMG"
    version: String, // "1.3"

    // === Voice Actors ===
    cv: {
      english: String,
      chinese: String,
      japanese: String,
      korean: String,
    },

    // === Base Stats (per level 1–90) ===
    stats: {
      type: mongoose.Schema.Types.Mixed, // { "1": {hp,atk,def,specialized}, ..., "90": {...} }
    },

    // === Ascension Costs ===
    costs: {
      type: mongoose.Schema.Types.Mixed, // keeps original structure
    },

    // === Images ===
    images: {
      type: mongoose.Schema.Types.Mixed,
    },

    // === URLs ===
    url: {
      type: mongoose.Schema.Types.Mixed,
    },

    // === Traveler-specific ===
    availableElements: [String], // ["Anemo","Geo","Electro","Dendro","Hydro","Pyro"] for Travelers
  },
  {
    timestamps: true,
    collection: "characters",
  }
);

// Compound index for fast queries
characterSchema.index({ game: 1, name: 1 }, { unique: true });
characterSchema.index({ game: 1, element: 1 });
characterSchema.index({ game: 1, weaponType: 1 });
characterSchema.index({ game: 1, rarity: 1 });
characterSchema.index({ game: 1, region: 1 });
characterSchema.index({ game: 1, path: 1 });

module.exports = mongoose.model("Character", characterSchema);
