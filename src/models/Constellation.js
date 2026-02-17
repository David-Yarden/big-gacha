const mongoose = require("mongoose");

const constellationSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },

    name: { type: String, required: true },
    c1: { name: String, description: String },
    c2: { name: String, description: String },
    c3: { name: String, description: String },
    c4: { name: String, description: String },
    c5: { name: String, description: String },
    c6: { name: String, description: String },

    images: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "constellations" }
);

constellationSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Constellation", constellationSchema);
