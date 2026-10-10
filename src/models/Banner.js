const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

/**
 * A limited banner (wish, warp, signal search, convene, headhunting): its dates and the
 * characters or weapons it features. Filled by src/scripts/seedBanners.js.
 */
const bannerSchema = new mongoose.Schema(
  {
    game: { type: String, required: true, enum: GAME_IDS, index: true },
    // Stable key from the source (e.g. the wiki page "Horizon of Dawnbreak/2026-09-30")
    name: { type: String, required: true },
    title: String,
    // character | weapon | chronicled (Genshin, both kinds)
    kind: { type: String, index: true },
    collab: Boolean,
    version: String,
    start: { type: Date, index: true },
    end: Date,
    // name: the site's name when known (links), rarity, rateUp: boosted (vs. simply in the pool)
    featured: [{ _id: false, name: String, rarity: Number, kind: String, rateUp: Boolean }],
    image: String,
    source: String,
  },
  { timestamps: true, collection: "banners" }
);

bannerSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Banner", bannerSchema);
