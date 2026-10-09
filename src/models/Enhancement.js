const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

/**
 * One kit enhancement entry (loaded from shared/games/<game>/enhancements/*.yaml).
 * The YAML files are the source of truth; this collection is rebuilt from them.
 */
const enhancementSchema = new mongoose.Schema(
  {
    game: { type: String, required: true, enum: GAME_IDS, index: true },
    type: { type: String, required: true },      // mechanic id, e.g. "hexerei"
    character: { type: String, required: true, index: true },
    target: { type: String, required: true },    // e.g. "constellation.c1"
    text: String,                                // addition
    original: mongoose.Schema.Types.Mixed,       // rework: { name, description }
    enhanced: mongoose.Schema.Types.Mixed,       // rework: { name, description }
    sources: [String],
    order: Number,                               // position in the file
  },
  { timestamps: true, collection: "enhancements" }
);

enhancementSchema.index({ game: 1, character: 1 });

/** Mechanic metadata (one per YAML file). */
const enhancementTypeSchema = new mongoose.Schema(
  {
    game: { type: String, required: true, enum: GAME_IDS },
    id: { type: String, required: true },
    name: { type: String, required: true },
    version: String,
    kind: { type: String, enum: ["addition", "rework"], required: true },
    color: String,
    condition: String,
    description: String,
    verified: { type: Boolean, default: true },
    characters: [String],
    file: String,
  },
  { timestamps: true, collection: "enhancement_types" }
);

enhancementTypeSchema.index({ game: 1, id: 1 }, { unique: true });

module.exports = {
  Enhancement: mongoose.model("Enhancement", enhancementSchema),
  EnhancementType: mongoose.model("EnhancementType", enhancementTypeSchema),
};
