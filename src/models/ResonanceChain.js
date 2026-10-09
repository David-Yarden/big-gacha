const mongoose = require("mongoose");

/**
 * WuWa Resonance Chain — equivalent to Genshin Constellations and HSR Eidolons.
 * Unlocked by obtaining duplicate resonators (same as Genshin C1–C6).
 * Uses S1–S6 naming (Sequences). S3/S5 grant direct buffs, not skill level boosts.
 */

const resonanceChainSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },

    name: { type: String, required: true }, // resonator name (FK)

    // S1–S6 — each has a name and description
    s1: { name: String, description: String },
    s2: { name: String, description: String },
    s3: { name: String, description: String },
    s4: { name: String, description: String },
    s5: { name: String, description: String },
    s6: { name: String, description: String },

    // Sequence icon URLs keyed s1…s6
    images: mongoose.Schema.Types.Mixed,

    // Rover support
    isTraveler: { type: Boolean, default: false },
    elementVariants: mongoose.Schema.Types.Mixed, // { Spectro: { s1…s6, images }, Havoc: { … } }
  },
  { timestamps: true, collection: "resonancechains" }
);

resonanceChainSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("ResonanceChain", resonanceChainSchema);
