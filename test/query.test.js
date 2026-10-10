// Unit tests for the query helpers — run with: npm test
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { escapeRegex, cleanFieldList, filterableFields } = require("../src/utils/query");
const { buildFilter } = require("../src/middleware/queryBuilder");

// Minimal stand-in for a Mongoose model (only what the helpers use)
function fakeModel(paths) {
  const entries = Object.entries(paths).map(([path, instance]) => [
    path,
    typeof instance === "string" ? { instance } : instance,
  ]);
  const map = new Map(entries);
  return {
    schema: {
      eachPath(fn) { for (const [p, t] of map) fn(p, t); },
      path(p) { return map.get(p); },
    },
  };
}

const Character = fakeModel({
  game: "String",
  name: "String",
  element: "String",
  region: "String",
  rarity: "Number",
  stats: "Mixed",
  "cv.english": "String",
  availableElements: { instance: "Array", caster: { instance: "String" } },
});

test("escapeRegex neutralises special characters", () => {
  assert.equal(escapeRegex("What Is Real?"), "What Is Real\\?");
  assert.ok(new RegExp(`^${escapeRegex("a.b(c)+")}$`).test("a.b(c)+"));
  assert.ok(!new RegExp(`^${escapeRegex("a.b")}$`).test("axb"));
});

test("filterableFields keeps only top-level scalar fields", () => {
  const f = filterableFields(Character);
  assert.ok(f.has("element"));
  assert.ok(f.has("rarity"));
  assert.ok(f.has("availableElements"));
  assert.ok(!f.has("stats"));
  assert.ok(!f.has("cv.english"));
});

test("cleanFieldList drops unknown fields and keeps sort direction", () => {
  const allowed = new Set(["name", "rarity"]);
  assert.deepEqual(cleanFieldList("-rarity,$where,name,stats", allowed, { allowDesc: true }), ["-rarity", "name"]);
  assert.deepEqual(cleanFieldList(undefined, allowed), []);
});

test("buildFilter ignores operator injection and unknown keys", () => {
  const filter = buildFilter(Character, {
    name: { $ne: "x" },       // ?name[$ne]=x
    $where: "sleep(1000)",
    stats: "x",
    element: "Pyro",
    rarity: "5",
  });
  assert.deepEqual(filter, { element: "Pyro", rarity: 5 });
});

test("buildFilter escapes the search string", () => {
  const filter = buildFilter(Character, { search: "What Is Real?" });
  // English or French name
  assert.equal(filter.$or[0].name.$regex, "What Is Real\\?");
  assert.equal(filter.$or[1]["i18n.fr.name"].$regex, "What Is Real\\?");
});

test("buildFilter maps region=Others to empty regions", () => {
  const filter = buildFilter(Character, { region: "Others" });
  assert.ok(Array.isArray(filter.$or));
});

test("buildFilter drops non-numeric values on numeric fields", () => {
  assert.deepEqual(buildFilter(Character, { rarity: "abc" }), {});
});
