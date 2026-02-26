const mongoose = require("mongoose");

/**
 * HSR Traces — equivalent to Genshin Talents.
 *
 * Each character has up to 5 skills:
 *   basicAtk  — Basic Attack (max level 6)
 *   skill     — Skill         (max level 10)
 *   ultimate  — Ultimate      (max level 10)
 *   talent    — Talent/passive (max level 10)
 *   technique — Technique     (fixed, no levels)
 *
 * Plus stat bonus nodes unlocked at ascension milestones (A2/A4/A6).
 *
 * costs is keyed per skill type, then per level:
 *   { basicAtk: { lvl2: [{id,name,count}], …, lvl6: […] },
 *     skill:    { lvl2: […], …, lvl10: […] }, … }
 */

const traceSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },

    name: { type: String, required: true }, // character name (FK)

    // Leveled active/passive skills
    basicAtk:  mongoose.Schema.Types.Mixed, // { name, maxLevel, desc, params, icon }
    skill:     mongoose.Schema.Types.Mixed,
    ultimate:  mongoose.Schema.Types.Mixed,
    talent:    mongoose.Schema.Types.Mixed,
    technique: mongoose.Schema.Types.Mixed, // { name, desc, icon } — no levels

    // Elation Skill — Sparxie, Yao Guang
    elation: mongoose.Schema.Types.Mixed,

    // Memosprite groups — one per skill_tree node; skills in the same node level together.
    // Each element: { skills: [{ name, maxLevel, desc, params, icon }], costs: { lvl2: [...] } }
    memospriteGroups: [mongoose.Schema.Types.Mixed],

    // Major trace nodes — named passive abilities (A2 / A4 / A6)
    // [{ name, desc, params, icon, unlockPhase }, …]
    majorTraces: [mongoose.Schema.Types.Mixed],

    // Minor stat bonus nodes (A2 / A4 / A6 unlocks)
    // [{ stat: "CriticalChance", value: 0.053, unlockPhase: 2 }, …]
    statBonuses: [mongoose.Schema.Types.Mixed],

    // Upgrade costs per skill, per level
    costs: mongoose.Schema.Types.Mixed,

    // Skill icon URLs keyed by skill type
    // { basicAtk: url, skill: url, ultimate: url, talent: url, technique: url }
    images: mongoose.Schema.Types.Mixed,

    // Trailblazer support
    isTraveler: { type: Boolean, default: false },
    elementVariants: mongoose.Schema.Types.Mixed, // { Fire: { basicAtk, skill, … }, Ice: { … }, … }
  },
  { timestamps: true, collection: "traces" }
);

traceSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Trace", traceSchema);
