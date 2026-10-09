const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

/** Last known state of each game's data source (one document per game). */
const syncStateSchema = new mongoose.Schema(
  {
    game: { type: String, required: true, enum: GAME_IDS, unique: true },
    source: String,               // e.g. "Mar-7th/StarRailRes"
    upstreamVersion: String,      // npm version or commit SHA last imported
    skippedUpstream: String,      // version the user rolled back: not re-imported automatically
    gameVersion: String,          // game version detected from the source (e.g. "4.6")
    lastCheckAt: Date,
    lastSyncAt: Date,
    lastStatus: { type: String, enum: ["up-to-date", "applied", "failed", "dry-run", "running"] },
    lastError: String,
    unseen: { type: Boolean, default: false }, // true until the "Updates" page is opened
  },
  { timestamps: true, collection: "sync_state" }
);

module.exports = mongoose.model("SyncState", syncStateSchema);
