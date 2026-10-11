const test = require("node:test");
const assert = require("node:assert");
const { clean } = require("../src/routes/decks");

test("decks: only known fields, as plain values", () => {
  const d = clean({
    name: { $ne: "x" },
    team: ["Nia", { $gt: "" }, "Hilde", "Olga", "Rin"],
    cards: [
      { uid: "a1", source: "kit", owner: "Nia", cardId: "c_1003_srt1", level: "2", divineId: "d1", hack: 1 },
      { uid: "a2", source: "evil", cardId: "x" },
      { uid: "a3", source: "extra", cardId: { $where: "1" } },
      { uid: "a4", source: "extra", cardId: "eidolon_card_01", engravings: ["e1", { $x: 1 }, "e3"] },
    ],
  });
  assert.strictEqual(d.name, "New deck");
  assert.deepStrictEqual(d.team, ["Nia", "Hilde", "Olga"]);
  assert.strictEqual(d.cards.length, 2);
  assert.strictEqual(d.cards[0].level, 2);
  assert.strictEqual(d.cards[0].hack, undefined);
  assert.deepStrictEqual(d.cards[1].engravings, ["e1", ""]);
});

test("decks: level kept within 0-9", () => {
  const d = clean({ cards: [{ uid: "a", source: "kit", cardId: "c", level: 99 }, { uid: "b", source: "kit", cardId: "c", level: -3 }] });
  assert.deepStrictEqual(d.cards.map((c) => c.level), [9, 0]);
});
