const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

/**
 * ZZZ Agent kit — equivalent of Genshin Talents + Constellations.
 *
 * skills.{basic,dodge,assist,special,chain}:
 *   { name, entries: [{ name, desc }], params: [{ group, name, values: [lv1…lv16] }], maxLevel }
 * core: { name, levels: [{ level: 0…6, label: "Base"|"A"…"F", desc, unlockLevel, stats: [{ name, value }] }],
 *         additional: { name, desc } }
 * mindscapes: [{ index: 1…6, name, desc, flavor }]
 * costs: { basic: { lvl2: [{ id, name, count, icon }] … lvl12 }, …, core: { lvl2 … lvl7 } }
 */
const agentKitSchema = new mongoose.Schema(
  {
    game: { type: String, required: true, enum: GAME_IDS, index: true },
    name: { type: String, required: true }, // agent name (FK)
    skills: mongoose.Schema.Types.Mixed,
    core: mongoose.Schema.Types.Mixed,
    mindscapes: [mongoose.Schema.Types.Mixed],
    // Endfield: talents [{ name, icon, ranks: [{ rank, promotion, desc }] }],
    // attribute nodes [{ name, desc, promotion, cost }], potentials [{ index, name, desc }]
    talents: [mongoose.Schema.Types.Mixed],
    attributes: [mongoose.Schema.Types.Mixed],
    potentials: [mongoose.Schema.Types.Mixed],
    costs: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "agentkits" }
);

agentKitSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("AgentKit", agentKitSchema);
