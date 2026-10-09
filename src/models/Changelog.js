const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

/** One entry per synchronisation run that changed (or tried to change) data. */
const changelogSchema = new mongoose.Schema(
  {
    game: { type: String, required: true, enum: GAME_IDS, index: true },
    status: { type: String, enum: ["applied", "failed", "dry-run", "rolled-back"], required: true },
    upstreamBefore: String,
    upstreamAfter: String,
    gameVersion: String,
    added: [{ model: String, name: String, _id: false }],
    changed: [{ model: String, name: String, fields: [String], _id: false }],
    missing: [{ model: String, name: String, _id: false }], // in the DB but not in the source anymore
    counts: mongoose.Schema.Types.Mixed,                    // { Character: 80, … } after the run
    problems: [String],  // validation errors ("errors" is reserved by Mongoose)
    warnings: [String],
    backup: String,                                          // backup folder name, for rollback
    durationMs: Number,
  },
  { timestamps: true, collection: "changelog" }
);

changelogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Changelog", changelogSchema);
