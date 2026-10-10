/**
 * Official translations: text differences and pairing of the two seeder runs.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { textDiff, attachTranslations } = require("../src/sync/i18n");

test("textDiff keeps only the texts that differ, in the same shape", () => {
  const en = { name: "Kafka", rarity: 5, element: "Lightning", skills: [{ name: "Midnight Tumult", params: [1, 2] }, { name: "Same" }] };
  const fr = { name: "Kafka", rarity: 5, element: "Foudre", skills: [{ name: "Tumulte de minuit", params: [1, 2] }, { name: "Same" }] };
  assert.deepEqual(textDiff(en, fr), { skills: [{ name: "Tumulte de minuit" }, null] });
});

test("textDiff: arrays of another length and objects keyed by text are replaced whole", () => {
  assert.deepEqual(textDiff({ a: ["x", "y"] }, { a: ["x"] }), { a: ["x"] });
  assert.deepEqual(textDiff({ costs: { "Normal Attack": [1] } }, { costs: { "Attaque normale": [1] } }), {
    costs: { $replace: { "Attaque normale": [1] } },
  });
});

test("attachTranslations pairs documents by position, fingerprint or source id", () => {
  const up = (model, name, set) => ({ op: "upsert", model, filter: { game: "hsr", name }, set: { name, ...set } });
  const en = [up("Character", "March 7th", { sourceId: 1001, description: "Hi" }), up("Material", "Credit", { rarity: 3 })];
  const fr = [up("Character", "March 7th", { sourceId: 1001, description: "Salut" }), up("Material", "Crédit", { rarity: 3 })];
  const stats = attachTranslations(en, fr, "fr");
  assert.deepEqual(stats, { Character: { matched: 1, unmatched: 0, names: [] }, Material: { matched: 1, unmatched: 0, names: [] } });
  assert.deepEqual(en[0].set.i18n, { fr: { description: "Salut" } });
  assert.deepEqual(en[1].set.i18n, { fr: { name: "Crédit" } });
});

test("textDiff never replaces a whole document or an object with key fields", () => {
  const d = textDiff({ name: "Rover", element: "Spectro" }, { name: "Nomade-Spectro", other: "x", element: "Spectro" });
  assert.equal(d.$replace, undefined);
  assert.equal(d.name, "Nomade-Spectro");
});
