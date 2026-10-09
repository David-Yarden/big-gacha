const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

/**
 * WuWa Echo — individual equippable monster with no direct Genshin/HSR equivalent.
 *
 * Key concepts:
 * - Each echo belongs to a Sonata set (EchoSet) and has a cost class:
 *     Common (cost 1), Elite (cost 3), Overlord (cost 4), Calamity (cost 4)
 * - Five echoes are equipped totalling ≤12 cost budget
 * - Only the slot-1 echo's skill activates in combat
 * - Main stat pool is determined by cost class, not by echo identity
 */

const echoSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: GAME_IDS,
      index: true,
    },

    sourceId: String, // game internal ID

    name: { type: String, required: true }, // echo monster name (e.g. "Impermanence Heron")
    description: String,

    element: { type: String, index: true }, // echo's elemental attribute

    // Cost class — determines budget weight and main stat pool
    echoClass: {
      type: String,
      enum: ["Common", "Elite", "Overlord", "Calamity"],
      index: true,
    },
    cost: { type: Number, enum: [1, 3, 4], index: true },

    // Sonata set this echo belongs to — references EchoSet.name
    sonataSet: { type: String, index: true },
    // Every set the echo can roll (an echo usually has several)
    sonataSets: { type: [String], index: true },

    // Echo skill — only active when equipped in slot 1
    // { name, desc, params: [[Number]], cooldown }
    skill: mongoose.Schema.Types.Mixed,

    // Main stat options available for this echo's cost class
    mainStatOptions: [String],

    images: mongoose.Schema.Types.Mixed, // { icon: String }
  },
  { timestamps: true, collection: "echoes" }
);

echoSchema.index({ game: 1, name: 1 }, { unique: true });
echoSchema.index({ game: 1, sonataSet: 1 });
echoSchema.index({ game: 1, echoClass: 1 });

module.exports = mongoose.model("Echo", echoSchema);
