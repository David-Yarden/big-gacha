/**
 * Helpers to ask data sources for their latest version.
 */
const fs = require("fs");
const path = require("path");
const { fetchData } = require("./http");

const PROJECT_ROOT = path.join(__dirname, "..", "..");

function githubHeaders() {
  const h = { "User-Agent": "big-gacha-sync", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

/** Latest commits of a GitHub repo: [{ sha, date, message }] */
async function githubCommits(repo, count = 10) {
  const list = await fetchData(`https://api.github.com/repos/${repo}/commits?per_page=${count}`, {
    headers: githubHeaders(),
    timeout: 30_000,
  });
  return list.map((c) => ({ sha: c.sha, date: c.commit?.author?.date, message: c.commit?.message || "" }));
}

/**
 * First game version mentioned in a list of commit messages, e.g.
 * "✨ Update to version 4.6" → "4.6", "[3.1.0] Launcher: …" → "3.1".
 */
function versionFromCommits(commits, pattern) {
  for (const c of commits) {
    const m = c.message.match(pattern);
    if (m) return m[1].split(".").slice(0, 2).join(".");
  }
  return null;
}

async function npmLatestVersion(pkg) {
  const latest = await fetchData(`https://registry.npmjs.org/${pkg}/latest`, { timeout: 30_000 });
  // Only plain x.y.z versions are installed automatically
  if (!/^\d+\.\d+\.\d+$/.test(latest?.version || "")) throw new Error(`npm ${pkg}: unexpected version "${latest?.version}"`);
  return latest.version;
}

function npmInstalledVersion(pkg) {
  try {
    const file = path.join(PROJECT_ROOT, "node_modules", pkg, "package.json");
    return JSON.parse(fs.readFileSync(file, "utf8")).version;
  } catch {
    return null;
  }
}

/** Compare "5.2.14" > "5.2.9" numerically. */
function semverGreater(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** Compare game versions like "4.6" and "4.10". */
function compareGameVersions(a, b) {
  if (a === b) return 0;
  return semverGreater(a, b) ? 1 : -1;
}

/**
 * Files changed between two commits of a GitHub repo, or null when unknown
 * (API error, or more than 300 files: the list would be truncated).
 */
async function githubChangedFiles(repo, base, head) {
  try {
    const cmp = await fetchData(`https://api.github.com/repos/${repo}/compare/${base}...${head}`, {
      headers: githubHeaders(),
      timeout: 30_000,
      retries: 1,
    });
    const files = (cmp.files || []).map((f) => f.filename);
    return files.length >= 300 ? null : files;
  } catch {
    return null;
  }
}

/** SHA of the last commit (up to `ref`) that touched a path, or null. */
async function githubLastCommitFor(repo, filePath, ref = "HEAD") {
  try {
    const list = await fetchData(
      `https://api.github.com/repos/${repo}/commits?path=${encodeURIComponent(filePath)}&sha=${ref}&per_page=1`,
      { headers: githubHeaders(), timeout: 30_000, retries: 1 }
    );
    return list[0]?.sha || null;
  } catch {
    return null;
  }
}

module.exports = {
  PROJECT_ROOT,
  githubCommits,
  githubChangedFiles,
  githubLastCommitFor,
  versionFromCommits,
  npmLatestVersion,
  npmInstalledVersion,
  semverGreater,
  compareGameVersions,
};
