/**
 * Genshin Impact — data comes from the `genshin-db` npm package.
 * A new game version = a new package release, so the adapter updates the
 * package itself before re-reading the data.
 */
const path = require("path");
const { exec } = require("child_process");
const {
  PROJECT_ROOT,
  npmLatestVersion,
  npmInstalledVersion,
  semverGreater,
  compareGameVersions,
} = require("../upstream");

const PKG = "genshin-db";

function npmInstall(spec) {
  return new Promise((resolve, reject) => {
    exec(`npm install ${spec} --no-audit --no-fund`, { cwd: PROJECT_ROOT, timeout: 10 * 60 * 1000, windowsHide: true }, (err, stdout, stderr) => {
      if (err) reject(new Error(`npm install ${spec} failed: ${stderr || err.message}`));
      else resolve(stdout);
    });
  });
}

/** Forget cached copies of genshin-db and the seeder so a fresh package is read. */
function purgeRequireCache() {
  const seederPath = require.resolve("../../scripts/seedGenshin");
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}node_modules${path.sep}${PKG}${path.sep}`) || key === seederPath) {
      delete require.cache[key];
    }
  }
}

module.exports = {
  game: "genshin",
  source: "genshin-db (npm)",
  // Contract: every collection the seeders must produce, with a floor (~70 % of Oct 2026)
  expect: { Character: 85, Weapon: 175, Artifact: 45, Material: 600, Talent: 85, Constellation: 85 },

  async check() {
    const latest = await npmLatestVersion(PKG);
    const installed = npmInstalledVersion(PKG);
    return {
      upstreamVersion: latest,
      installedVersion: installed,
      needsPackageUpdate: !!installed && semverGreater(latest, installed),
      notes: installed && semverGreater(latest, installed)
        ? [`genshin-db ${latest} disponible (installé : ${installed})`]
        : [],
    };
  },

  async prepare(check) {
    if (check.needsPackageUpdate) {
      await npmInstall(`${PKG}@${check.upstreamVersion}`);
    }
  },

  /** Validation failed after an update: go back to the package that was installed. */
  async undoPrepare(check) {
    if (check.needsPackageUpdate && check.installedVersion) {
      await npmInstall(`${PKG}@${check.installedVersion}`);
      purgeRequireCache();
    }
  },

  async collect() {
    purgeRequireCache();
    const seeder = require("../../scripts/seedGenshin");
    await seeder.seedAll();
  },

  /** Highest character version found in the data = current game version. */
  detectGameVersion(ops) {
    let best = null;
    for (const op of ops) {
      const v = op.model === "Character" && op.set?.version;
      if (v && (!best || compareGameVersions(String(v), best) > 0)) best = String(v);
    }
    return best;
  },
};
