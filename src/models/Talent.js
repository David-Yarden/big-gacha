const mongoose = require("mongoose");

const talentSchema = new mongoose.Schema(
  {
    game: {
      type: String,
      required: true,
      enum: ["genshin", "hsr", "zzz", "wuwa", "endfield"],
      index: true,
    },

    name: { type: String, required: true },
    combat1: mongoose.Schema.Types.Mixed,
    combat2: mongoose.Schema.Types.Mixed,
    combat3: mongoose.Schema.Types.Mixed,
    combatsp: mongoose.Schema.Types.Mixed,
    passive1: mongoose.Schema.Types.Mixed,
    passive2: mongoose.Schema.Types.Mixed,
    passive3: mongoose.Schema.Types.Mixed,
    passive4: mongoose.Schema.Types.Mixed,

    costs: mongoose.Schema.Types.Mixed,
    images: mongoose.Schema.Types.Mixed,

    isTraveler: { type: Boolean, default: false },
    elementVariants: mongoose.Schema.Types.Mixed, // { Anemo: { combat1, combat2, …, images }, … }
  },
  { timestamps: true, collection: "talents" }
);

talentSchema.index({ game: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Talent", talentSchema);
