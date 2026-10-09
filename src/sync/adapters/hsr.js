/**
 * Honkai: Star Rail — data comes from the Mar-7th/StarRailRes GitHub repository.
 * Its commits announce game versions ("✨ Update to version 4.6").
 */
const { githubCommits, githubChangedFiles, versionFromCommits } = require("../upstream");

// Paths of the repository our seeders read: commits elsewhere do not need a sync
const DATA_PATHS = ["index_new/en/"];

const REPO = "Mar-7th/StarRailRes";

module.exports = {
  game: "hsr",
  source: REPO,
  // Contract: every collection the seeders must produce, with a floor (~70 % of Oct 2026)
  expect: { Character: 60, LightCone: 120, Relic: 40, Material: 2400, Trace: 60, Eidolon: 60 },

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
      gameVersion: versionFromCommits(commits, /version (\d+\.\d+(?:\.\d+)?)/i),
      notes: [],
    };
  },

  async collect(check) {
    // Re-read the seeder and its helpers so code updates apply without a restart
    delete require.cache[require.resolve("../../scripts/seedHsr")];
    delete require.cache[require.resolve("../../scripts/hsrData")];
    require("../../scripts/hsrData").setDataRef(check?.ref);
    const seeder = require("../../scripts/seedHsr");
    await seeder.seedAll();
  },
};
