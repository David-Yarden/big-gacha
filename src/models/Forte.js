const mongoose = require("mongoose");

/**
 * WuWa Forte — equivalent to Genshin Talents and HSR Traces.
 *
 * WuWa has five leveled active skills (all level 1–10):
 *   basicAtk            — Basic Attack
 *   resonanceSkill      — Resonance Skill
 *   resonanceLiberation — Resonance Liberation (ultimate)
 *   forteCircuit        — Forte Circuit (signature passive mechanic)
 *   introSkill          — Intro Skill (triggered on character switch-in)
 *
 * Plus 2 Inherent Skills (passive, milestone-unlocked, no level),
 * and stat bonus nodes unlocked through the tree.
 *
 * costs is keyed per skill type, then per level:
 *   { basicAtk: { lvl2: [{id,name,count}], …, lvl10: […] }, … }
 */

const forteSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },

    name: { type: String, required: true }, // resonator name (FK)

    // Five leveled active skills — each: { name, maxLevel, desc, params, icon }
    basicAtk:            mongoose.Schema.Types.Mixed,
    resonanceSkill:      mongoose.Schema.Types.Mixed,
    resonanceLiberation: mongoose.Schema.Types.Mixed, // the "ultimate"
    forteCircuit:        mongoose.Schema.Types.Mixed, // signature passive mechanic
    introSkill:          mongoose.Schema.Types.Mixed, // triggered on switch-in

    // Inherent Skills — unlocked at ascension milestones, no level
    // [{ name, desc, icon, unlockPhase }]
    inherentSkill1: mongoose.Schema.Types.Mixed,
    inherentSkill2: mongoose.Schema.Types.Mixed,

    // Stat bonus nodes unlocked through the forte tree
    // [{ stat: "HP%", value: 0.06, unlockPhase: 2 }, …]
    statBonuses: [mongoose.Schema.Types.Mixed],

    // Upgrade costs per skill, per level
    costs: mongoose.Schema.Types.Mixed,

    // Skill icon URLs keyed by skill type
    images: mongoose.Schema.Types.Mixed,

    // Rover support
    isTraveler: { type: Boolean, default: false },
    elementVariants: mongoose.Schema.Types.Mixed, // { Spectro: { basicAtk, … }, Havoc: { … } }
  },
  { timestamps: true, collection: "fortes" }
);

forteSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Forte", forteSchema);
