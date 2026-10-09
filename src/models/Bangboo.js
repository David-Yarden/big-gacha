const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

/**
 * ZZZ Bangboo.
 * skills: [{ kind: "Active Skill"|"Additional Ability"|"Chain Attack", name, desc,
 *            params: [{ name, values: [per level] }], maxLevel }]
 */
const bangbooSchema = new mongoose.Schema(
  {
    game: { type: String, required: true, enum: GAME_IDS, index: true },
    sourceId: Number,
    name: { type: String, required: true },
    rarity: { type: Number, index: true }, // 4 = A, 5 = S
    description: String,
    stats: mongoose.Schema.Types.Mixed, // { "60": { hp, atk, def } }
    skills: [mongoose.Schema.Types.Mixed],
    costs: mongoose.Schema.Types.Mixed,
    version: String,
    images: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "bangboos" }
);

bangbooSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Bangboo", bangbooSchema);
