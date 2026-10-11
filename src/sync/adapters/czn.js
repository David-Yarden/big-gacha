/**
 * Chaos Zero Nightmare — data from steve1316/hub-czn-updated (GitHub, MIT: tables a CZN
 * gear optimizer reads from the game's own files) and the Chaos Zero Nightmare Wiki
 * (czn.miraheze.org, CC BY-SA 4.0, normal pages only: its robots.txt forbids the API).
 * A commit touching the repository's data starts a sync; the wiki is read along with it.
 */
const { githubCommits, githubChangedFiles } = require("../upstream");

const REPO = "steve1316/hub-czn-updated";
// Paths of the repository our seeder reads: commits elsewhere (app code) do not need a sync
const DATA_PATHS = ["api/data/", "api/game_data/", "android-app/app/src/main/assets/"];

module.exports = {
  game: "czn",
  source: REPO,
  // Floors (~70 % of Oct 2026: 38 combatants, 32 decks, 50 partners, 21 fragment sets)
  expect: { Character: 26, AgentKit: 22, Weapon: 35, Relic: 14 },

  async check(previous) {
    const commits = await githubCommits(REPO, 20);
    if (!commits.length) throw new Error(`${REPO}: no commits returned`);
    const head = commits[0].sha;
    let irrelevant = false;
    if (previous && !head.startsWith(previous)) {
      const files = await githubChangedFiles(REPO, previous, head);
      irrelevant = !!files && !files.some((f) => DATA_PATHS.some((p) => f.startsWith(p)));
    }
    return { upstreamVersion: head.slice(0, 12), ref: head, irrelevant, upstreamDate: commits[0].date, gameVersion: null, notes: [] };
  },

  async collect(check) {
    // Re-read the seeder so code updates apply without a restart
    delete require.cache[require.resolve("../../scripts/seedCzn")];
    delete require.cache[require.resolve("../../scripts/cznParse")];
    const seeder = require("../../scripts/seedCzn");
    seeder.setRef(check?.ref);
    await seeder.seedAll();
  },
};
