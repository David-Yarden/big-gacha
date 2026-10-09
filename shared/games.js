/**
 * Node-side access to the game registry (shared/games.json).
 */
const { games } = require("./games.json");

const GAME_IDS = games.map((g) => g.id);

function getGame(id) {
  return games.find((g) => g.id === id) || null;
}

module.exports = { games, GAME_IDS, getGame };
