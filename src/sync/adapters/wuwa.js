/**
 * Wuthering Waves — data comes from the Arikatsu/WutheringWaves_Data GitHub
 * repository (datamined BinData + Textmaps). Its commits name the game build
 * ("GameVer 3.7.0 ...").
 */
const { githubCommits, githubChangedFiles, versionFromCommits } = require("../upstream");

// Paths of the repository our seeders read: commits elsewhere do not need a sync
const DATA_PATHS = [
  "BinData/role/", "BinData/weapon/", "BinData/resonate_chain/", "BinData/phantom/", "BinData/skill/",
  "BinData/skillTree/", "BinData/item/", "BinData/property/", "BinData/role_level/", "BinData/favor/",
  "BinData/accesspath/", "Textmaps/en/multi_text/",
];

const REPO = "Arikatsu/WutheringWaves_Data";
// Commit messages look like "GameVer 3.7.0 ..."
const VERSION_RE = /GameVer\s*(\d+\.\d+)/i;

module.exports = {
  game: "wuwa",
  source: REPO,
  // Contract: every collection the seeders must produce, with a floor (~70 % of Oct 2026)
  // Official translations also imported (second run of the seeders, see sync/i18n.js)
  languages: ["fr"],
  expect: { Character: 40, Weapon: 80, Material: 100, Forte: 40, ResonanceChain: 40, Echo: 170, EchoSet: 25 },
  VERSION_RE,

  async check(previous) {
    const commits = await githubCommits(REPO, 20);
    if (!commits.length) throw new Error(`${REPO}: no commits returned`);
    const head = commits[0].sha;
    let irrelevant = false;
    if (previous && !head.startsWith(previous)) {
      const files = await githubChangedFiles(REPO, previous, head);
      irrelevant = !!files && !files.some((f) => DATA_PATHS.some((p) => f.startsWith(p)));
    }
    return {
      upstreamVersion: commits[0].sha.slice(0, 12),
      ref: commits[0].sha,
      irrelevant,
      upstreamDate: commits[0].date,
      gameVersion: versionFromCommits(commits, VERSION_RE),
      notes: [],
    };
  },

  async collect(check) {
    delete require.cache[require.resolve("../../scripts/seedWuwa")];
    const seeder = require("../../scripts/seedWuwa");
    seeder.setRef(check?.ref);
    seeder.setLang(check?.lang);
    await seeder.seedAll();
  },
};
