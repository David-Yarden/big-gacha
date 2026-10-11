/**
 * Plugins of this computer only: every folder of ./local that holds a server.js is loaded
 * at start-up (none ships with the project). A plugin exports `(app, ctx) => void` and adds
 * its own routes under /api/local/<folder>.
 */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "local");

function load(app) {
  if (!fs.existsSync(DIR)) return [];
  const loaded = [];
  for (const name of fs.readdirSync(DIR)) {
    const file = path.join(DIR, name, "server.js");
    if (!fs.existsSync(file)) continue;
    try {
      require(file)(app, { root: path.join(__dirname, ".."), name, fetchData: require("./sync/http").fetchData });
      loaded.push(name);
    } catch (err) {
      console.warn(`⚠ Plugin local « ${name} » : ${err.message}`);
    }
  }
  if (loaded.length) console.log(`🔌 Plugins locaux : ${loaded.join(", ")}`);
  return loaded;
}

module.exports = { load };
