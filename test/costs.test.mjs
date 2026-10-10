/**
 * Cost calculations of the character pages and the farm planner (client/src/lib/materials.ts).
 * The TypeScript file is loaded directly: Node 23.6+ strips the types by itself.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const m = await import("../client/src/lib/materials.ts");

const count = (list, name) => list.find((x) => x.name === name)?.count ?? 0;

// A small curve: 1 000 EXP per level, two items, 10 currency per item EXP / 10
const curve = {
  exp: [0, 0, 1000, 2000, 3000, 4000],
  items: [
    { id: 2, name: "Big", exp: 2000, coin: 200 },
    { id: 1, name: "Small", exp: 500, coin: 50 },
  ],
  coin: { id: 9, name: "Coin" },
};

test("expPotions: biggest item first, smallest rounds up, currency per item", () => {
  const out = m.expPotions(5, { levelExp: curve }); // 4 000 EXP
  assert.equal(count(out, "Big"), 2);
  assert.equal(count(out, "Small"), 0);
  assert.equal(count(out, "Coin"), 400);
  const odd = m.expPotions(4, { levelExp: { ...curve, exp: [0, 0, 1000, 2000, 2700] } }); // 2 700 EXP
  assert.equal(count(odd, "Big"), 1);
  assert.equal(count(odd, "Small"), 2); // 700 → 2 × 500
});

test("expPotions: only the EXP between the two levels", () => {
  const out = m.expPotions(5, { levelExp: curve }, 3); // 4 000 − 2 000
  assert.equal(count(out, "Big"), 1);
  assert.deepEqual(m.expPotions(3, { levelExp: curve }, 5), []); // nothing when going down
  assert.deepEqual(m.expPotions(3, { levelExp: curve }, 3), []);
});

test("expPotions: currency charged per level (Endfield T-Creds)", () => {
  const perLevel = { ...curve, items: curve.items.map(({ coin, ...it }) => it), coinByLevel: [0, 0, 10, 30, 60, 100] };
  assert.equal(count(m.expPotions(5, { levelExp: perLevel }), "Coin"), 100);
  assert.equal(count(m.expPotions(5, { levelExp: perLevel }, 3), "Coin"), 70);
  assert.equal(m.coinsBetween([0, 0, 10, 30], 3, 99), 0); // clamped to the table
});

test("calculateExpMaterials (Genshin character): full and partial ranges", () => {
  const full = m.calculateExpMaterials(90);
  assert.equal(count(full, "Hero's Wit"), 418); // 8 362 650 EXP
  assert.equal(count(full, "Mora"), 1672600);
  const part = m.calculateExpMaterials(90, 80); // 8 362 650 − 4 939 525
  assert.equal(count(part, "Hero's Wit"), 171);
  assert.deepEqual(m.calculateExpMaterials(80, 90), []);
  // 95 / 100 cost no EXP
  assert.deepEqual(m.calculateExpMaterials(100, 90), []);
});

test("calculateBreakthroughMaterials: Masterless Stella Fortuna between two levels", () => {
  assert.equal(m.calculateBreakthroughMaterials(100)[0].count, 3);
  assert.equal(m.calculateBreakthroughMaterials(100, 95)[0].count, 2);
  assert.deepEqual(m.calculateBreakthroughMaterials(95, 95), []);
});

test("ascension and skill costs add up phase by phase", () => {
  const costs = { ascend1: [{ id: 1, name: "A", count: 2 }], ascend2: [{ id: 1, name: "A", count: 3 }] };
  assert.equal(count(m.calculateAscensionMaterials(costs, 2), "A"), 5);
  const skill = { lvl2: [{ id: 1, name: "B", count: 1 }], lvl3: [{ id: 1, name: "B", count: 4 }] };
  assert.equal(count(m.calculateTalentMaterials(skill, 3), "B"), 5);
  assert.equal(count(m.calculateTalentMaterials(skill, 1), "B"), 0);
});

test("nodeCosts sums the one-time node costs without touching the nodes", () => {
  const nodes = [{ cost: [{ id: 2, name: "Credit", count: 5000 }] }, { cost: [{ id: 2, name: "Credit", count: 20000 }] }, {}];
  const stats = [{ stat: "ATK", value: 0.04, cost: [{ id: 2, name: "Credit", count: 2500 }] }, null];
  const total = m.nodeCosts(nodes, stats, undefined);
  assert.equal(count(total, "Credit"), 27500);
  assert.equal(nodes[0].cost[0].count, 5000); // inputs unchanged
});
