/**
 * Zenless Zone Zero — data comes from the malu-no996/ZenlessData GitHub repository
 * (datamined tables + TextMap) and the Enka Network store (stable ids and stats).
 * Its commits name the game build ("OSPRODWin3.2.0_R…", "CNPRODWin3.2.0_R…").
 */
const { githubCommits, githubChangedFiles, versionFromCommits } = require("../upstream");

// Paths of the repository our seeders read: commits elsewhere do not need a sync
const DATA_PATHS = ["FileCfg/", "TextMap/TextMap_EN"];

const REPO = "malu-no996/ZenlessData";
const VERSION_RE = /PRODWin(\d+\.\d+)/i;

module.exports = {
  game: "zzz",
  source: REPO,
  // Contract: every collection the seeders must produce, with a floor (~70 % of Oct 2026)
  expect: { Character: 40, AgentKit: 40, Weapon: 60, Relic: 20, Bangboo: 25, Material: 30 },
  VERSION_RE,
  // Official translations also imported (second run of the seeders, see sync/i18n.js)
  languages: ["fr"],

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
      upstreamVersion: head.slice(0, 12),
      ref: head,
      irrelevant,
      upstreamDate: commits[0].date,
      gameVersion: versionFromCommits(commits, VERSION_RE),
      notes: [],
    };
  },

  async collect(check) {
    delete require.cache[require.resolve("../../scripts/seedZzz")];
    const seeder = require("../../scripts/seedZzz");
    seeder.setRef(check?.ref);
    seeder.setLang(check?.lang);
    await seeder.seedAll();
  },
};
