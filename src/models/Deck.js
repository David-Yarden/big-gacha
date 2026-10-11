const mongoose = require("mongoose");
const { GAME_IDS } = require("../../shared/games");

/**
 * A deck built in the deck builder (Chaos Zero Nightmare): three combatants and the cards of
 * the deck, each with its chosen epiphany, divine and common epiphanies (or Persona
 * engravings). The game is stored as `deckGame` (not `game`) so that the sync's backups and
 * rollbacks of game data never touch the player's decks.
 */
const deckCardSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true },
    // "kit": a combatant's card (owner = combatant name); "extra": neutral, season, Persona…
    source: { type: String, enum: ["kit", "extra"], required: true },
    owner: String,
    cardId: { type: String, required: true },
    level: { type: Number, default: 0, min: 0, max: 9 },
    divineId: String,
    commonId: String,
    // Persona cards: the two engravings and the class they were chosen for
    engravings: [String],
    personaClass: String,
  },
  { _id: false }
);

const deckSchema = new mongoose.Schema(
  {
    deckGame: { type: String, required: true, enum: GAME_IDS, index: true },
    name: { type: String, required: true, maxlength: 80 },
    team: { type: [String], validate: (v) => v.length <= 3 },
    cards: { type: [deckCardSchema], validate: (v) => v.length <= 150 },
    notes: { type: String, maxlength: 2000 },
  },
  { timestamps: true, collection: "decks" }
);

module.exports = mongoose.model("Deck", deckSchema);
