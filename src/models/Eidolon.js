const mongoose = require("mongoose");

/**
 * HSR Eidolons — equivalent to Genshin Constellations.
 * E1–E6 unlocked by pulling duplicate characters.
 * E3 and E5 boost a skill's level cap (stored in levelUpSkills).
 */

const eidolonSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },

    name: { type: String, required: true }, // character name (FK)

    // E1–E6 — each has a name, description, and optional skill level boosts
    e1: { name: String, description: String, levelUpSkills: [mongoose.Schema.Types.Mixed] },
    e2: { name: String, description: String, levelUpSkills: [mongoose.Schema.Types.Mixed] },
    e3: { name: String, description: String, levelUpSkills: [mongoose.Schema.Types.Mixed] },
    e4: { name: String, description: String, levelUpSkills: [mongoose.Schema.Types.Mixed] },
    e5: { name: String, description: String, levelUpSkills: [mongoose.Schema.Types.Mixed] },
    e6: { name: String, description: String, levelUpSkills: [mongoose.Schema.Types.Mixed] },

    // Eidolon icon URLs keyed e1…e6
    images: mongoose.Schema.Types.Mixed,

    // Trailblazer support
    isTraveler: { type: Boolean, default: false },
    elementVariants: mongoose.Schema.Types.Mixed, // { Fire: { e1…e6, images }, … }
  },
  { timestamps: true, collection: "eidolons" }
);

eidolonSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Eidolon", eidolonSchema);
