const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

const characterSchema = new mongoose.Schema(
  {
    // === Meta ===
    game: {
      type: String,
      required: true,
      enum: GAME_IDS,
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
    specialty: { type: String, index: true }, // ZZZ: "Attack", "Stun", "Anomaly"…
    attackType: String, // ZZZ: "Slash", "Strike", "Pierce"
    subElement: String, // ZZZ: special attribute ("Frost", "Auric Ink", "Honed Edge")
    height: String,
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

    // EXP curve when the game defines it per character (WuWa):
    // { exp: [cumulative EXP indexed by level], items: [{ id, name, exp, icon }] }
    levelExp: mongoose.Schema.Types.Mixed,

    // Other base stats that do not grow with level (ZZZ): [{ name, value }] (value formatted)
    extraStats: mongoose.Schema.Types.Mixed,
    // Other profile facts shown with birthday and gender (CZN: species…): [{ name, value }]
    profile: mongoose.Schema.Types.Mixed,
    // Full-size artwork shown in a viewer: [{ label, src }] (CZN: splash, portrait, mental breakdown)
    gallery: mongoose.Schema.Types.Mixed,
    // Links to animated versions on another site: [{ label, url }]
    animated: mongoose.Schema.Types.Mixed,

    // Outfits: [{ name, desc, splash, icon, default }]
    skins: mongoose.Schema.Types.Mixed,
    // The game's recommended build (ZZZ: Drive Disc sets, main stats per slot, substats)
    build: mongoose.Schema.Types.Mixed,
    // Name of the signature weapon (ZZZ)
    signatureWeapon: String,

    // Hover glossary for kit texts: [{ name, desc }] (desc uses **bold**)
    glossary: mongoose.Schema.Types.Mixed,

    // === Images ===
    images: {
      type: mongoose.Schema.Types.Mixed,
    },

    // === URLs ===
    url: {
      type: mongoose.Schema.Types.Mixed,
    },

    // === Traveler-specific ===
    // Kit enhancement ids affecting this character (filled from shared/games/*/enhancements)
    enhancements: { type: [String], default: undefined, index: true },

    availableElements: [String], // ["Anemo","Geo","Electro","Dendro","Hydro","Pyro"] for Travelers
    // Multi-element characters (Trailblazer paths, Rover): per-element path, stats, costs, images
    isTraveler: Boolean,
    elementVariants: mongoose.Schema.Types.Mixed,
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
