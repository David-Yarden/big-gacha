/**
 * Sync engine: diff, validation and duplicate handling (no database needed —
 * models are only used to cast and validate documents).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
require("../src/models");
const { _test } = require("../src/sync/engine");
const { canon, computeDiff, validate, collapseDuplicates, hasImage } = _test;

const up = (model, name, set) => ({ op: "upsert", model, filter: { game: "hsr", name }, set: { game: "hsr", name, ...set } });
const existingOf = (model, docs) => ({ [model]: new Map(docs.map((d) => [d.name, { game: "hsr", ...d }])) });

test("canon ignores key order, null/undefined and empty objects", () => {
  assert.deepEqual(canon({ b: 1, a: { x: null, y: {} }, c: undefined }), { b: 1 });
  assert.equal(JSON.stringify(canon({ a: 1, b: 2 })), JSON.stringify(canon({ b: 2, a: 1 })));
});

test("empty values are equal: no endless change on \"\" vs missing", () => {
  const ops = [up("Character", "Aether", { region: undefined, images: { icon: "a" } })];
  const existing = existingOf("Character", [{ name: "Aether", region: "", images: { icon: "a" } }]);
  assert.equal(computeDiff(ops, existing, "6.0").changed.length, 0);
});

test("collapseDuplicates keeps the last write per model + name", () => {
  const ops = [up("Material", "Credit", { rarity: 2 }), up("Material", "Credit", { rarity: 3 }), up("Material", "Fuel", {})];
  const out = collapseDuplicates(ops);
  assert.equal(out.length, 2);
  assert.equal(out.find((o) => o.filter.name === "Credit").set.rarity, 3);
});

test("computeDiff: added, changed and missing", () => {
  const ops = [up("Character", "Kafka", { rarity: 5 }), up("Character", "Firefly", { rarity: 5 })];
  const existing = existingOf("Character", [
    { name: "Kafka", rarity: 4 },
    { name: "Seele", rarity: 5 },
  ]);
  const { added, changed, missing } = computeDiff(ops, existing, "4.6");
  assert.deepEqual(added.map((a) => a.name), ["Firefly"]);
  assert.deepEqual(changed.map((c) => [c.name, c.fields]), [["Kafka", ["rarity"]]]);
  assert.deepEqual(missing.map((m) => m.name), ["Seele"]);
});

test("computeDiff: identical data gives no change", () => {
  const ops = [up("Character", "Kafka", { rarity: 5, images: { icon: "a.png" } })];
  const existing = existingOf("Character", [{ name: "Kafka", rarity: 5, images: { icon: "a.png" } }]);
  const { added, changed } = computeDiff(ops, existing, "4.6");
  assert.equal(added.length + changed.length, 0);
});

test("computeDiff: a known version is never erased, new entities get the game version", () => {
  const ops = [up("Character", "Kafka", { version: null }), up("Character", "Cyrene", { version: null })];
  const existing = existingOf("Character", [{ name: "Kafka", version: "1.2" }]);
  computeDiff(ops, existing, "4.6");
  assert.equal("version" in ops[0].set, false); // kept as is in the database
  assert.equal(ops[1].set.version, "4.6");
});

test("computeDiff: first import of a collection does not stamp today's version", () => {
  const ops = [up("Character", "Kafka", { version: null })];
  computeDiff(ops, { Character: new Map() }, "4.6");
  assert.equal(ops[0].set.version ?? null, null);
});

test("validate: the adapter contract catches an empty or tiny collection", () => {
  const ops = [up("Character", "Kafka", { images: { icon: "a.png" } })];
  const touched = { Character: new Set(["Kafka"]) };
  const { errors } = validate(ops, {}, touched, { expect: { Character: 10, LightCone: 5 } });
  assert.ok(errors.some((e) => e.startsWith("Character: only 1")));
  assert.ok(errors.some((e) => e.startsWith("LightCone: nothing produced")));
});

test("validate: a > 10 % drop is an error, a warning when pruning on purpose", () => {
  const names = Array.from({ length: 30 }, (_, i) => `C${i}`);
  const existing = existingOf("Character", names.map((name) => ({ name })));
  const ops = names.slice(0, 20).map((n) => up("Character", n, { images: { icon: "x" } }));
  const touched = { Character: new Set(names.slice(0, 20)) };
  assert.ok(validate(ops, existing, touched).errors.some((e) => e.includes("10 % drop")));
  assert.ok(validate(ops, existing, touched, { prune: true }).warnings.some((e) => e.includes("10 % drop")));
});

test("validate: images are checked by value, not by key", () => {
  assert.equal(hasImage({ icon: undefined, splash: "" }), false);
  assert.equal(hasImage({ icon: "a.png" }), true);
  const ops = ["A", "B", "C"].map((n) => up("Character", n, { images: { icon: undefined } }));
  const { errors } = validate(ops, {}, { Character: new Set(["A", "B", "C"]) });
  assert.ok(errors.some((e) => e.includes("without any image")));
});
