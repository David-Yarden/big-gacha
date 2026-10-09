const { test } = require("node:test");
const assert = require("node:assert/strict");
const { versionFromCommits, semverGreater, compareGameVersions } = require("../src/sync/upstream");

test("game version is read from StarRailRes commit messages", () => {
  const commits = [{ message: "🐛 Fix avatar icon" }, { message: "✨ Update to version 4.6" }];
  assert.equal(versionFromCommits(commits, /version (\d+\.\d+(?:\.\d+)?)/i), "4.6");
});

test("game version is read from WutheringWaves_Data commit messages (adapter's own regex)", () => {
  const { VERSION_RE } = require("../src/sync/adapters/wuwa");
  const commits = [{ message: "Update data" }, { message: "GameVer 3.7.0 | Resource 3.7.12" }];
  assert.equal(versionFromCommits(commits, VERSION_RE), "3.7");
});

test("versions compare numerically", () => {
  assert.equal(semverGreater("5.2.14", "5.2.9"), true);
  assert.equal(semverGreater("5.2.9", "5.2.14"), false);
  assert.equal(compareGameVersions("4.10", "4.6"), 1);
  assert.equal(compareGameVersions("4.6", "4.6"), 0);
});
