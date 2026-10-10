/**
 * Arknights: Endfield — data comes from the 555me/beyondGameData GitHub repository (the
 * game's tables with English text inlined). Its commits are named after the resource
 * version ("10731330"), so the game version is read from the banner tables instead
 * (limited banners are named special_<major>_<minor>_<n>).
 */
const { githubCommits, githubChangedFiles } = require("../upstream");

// Paths of the repository our seeders read: commits elsewhere do not need a sync
const DATA_PATHS = ["tableCfg/"];

const REPO = "555me/beyondGameData";

module.exports = {
  game: "endfield",
  source: REPO,
  // Contract: every collection the seeders must produce, with a floor (~70 % of Oct 2026)
  // Official French texts too (second run, French from AKEData, see seedEndfield.js)
  languages: ["fr"],
  expect: { Character: 22, AgentKit: 22, Weapon: 55, Relic: 16, Material: 25 },

  async check(previous) {
    const commits = await githubCommits(REPO, 20);
    if (!commits.length) throw new Error(`${REPO}: no commits returned`);
    const head = commits[0].sha;
    let irrelevant = false;
    if (previous && !head.startsWith(previous)) {
      const files = await githubChangedFiles(REPO, previous, head);
      irrelevant = !!files && !files.some((f) => DATA_PATHS.some((p) => f.startsWith(p)));
    }
    delete require.cache[require.resolve("../../scripts/seedEndfield")];
    const gameVersion = await require("../../scripts/seedEndfield").latestVersion(head).catch(() => null);
    return {
      upstreamVersion: head.slice(0, 12),
      ref: head,
      irrelevant,
      upstreamDate: commits[0].date,
      gameVersion,
      notes: [],
    };
  },

  async collect(check) {
    // Re-read the seeder so code updates apply without a restart
    delete require.cache[require.resolve("../../scripts/seedEndfield")];
    const seeder = require("../../scripts/seedEndfield");
    seeder.setRef(check?.ref);
    seeder.setLang(check?.lang);
    await seeder.seedAll();
  },
};
