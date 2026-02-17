const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },
    sourceId: Number,

    name: { type: String, required: true },
    description: String,
    category: String,
    materialType: String,
    rarity: Number,
    source: [String],
    version: String,

    images: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "materials" }
);

materialSchema.index({ game: 1, name: 1 }, { unique: true });
materialSchema.index({ game: 1, category: 1 });

module.exports = mongoose.model("Material", materialSchema);
