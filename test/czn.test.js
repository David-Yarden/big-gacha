/**
 * Chaos Zero Nightmare seeder: reading the repository's Python tables and the wiki's
 * JSON modules (rendered as HTML tables on its normal pages).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const p = require("../src/scripts/cznParse");

test("pyLiteral: dicts, tuples, int keys, None, comments and calls", () => {
  const src = `
# header
X = 1
SETS = {
    6:  {"name": "Conqueror's Aspect", "pieces": 4, "icon_path": _ICON.format(6)},  # comment
    7:  {'name': 'Tetra\\'s "Authority"', "values": (12, 14,), "extra": None, "ok": True},
}
`;
  assert.deepEqual(p.pyLiteral(src, "SETS"), {
    6: { name: "Conqueror's Aspect", pieces: 4, icon_path: null },
    7: { name: 'Tetra\'s "Authority"', values: [12, 14], extra: null, ok: true },
  });
});

test("mwJson: objects, arrays and literals of a rendered JSON page", () => {
  const html = `<div class="noresize"><table class="mw-json"><tbody>
    <tr><th><span>Nia</span></th><td><table class="mw-json"><tbody>
      <tr><th><span>id</span></th><td class="mw-json-value">1003</td></tr>
      <tr><th><span>desc</span></th><td class="mw-json-value">"&lt;span class="czn-color-orange"&gt;Hi&lt;/span&gt;"</td></tr>
      <tr><th><span>levels</span></th><td><table class="mw-json"><tbody>
        <tr><td class="mw-json-value">1</td></tr><tr><td class="mw-json-value">2</td></tr>
      </tbody></table></td></tr>
    </tbody></table></td></tr>
  </tbody></table></div>`;
  assert.deepEqual(p.mwJson(html), { Nia: { id: 1003, desc: '<span class="czn-color-orange">Hi</span>', levels: [1, 2] } });
});

test("wikiText / cardText: the site's markup", () => {
  assert.equal(p.wikiText('Adds <span class="czn-color-orange">1</span> Freeze.<br>Next'), "Adds [[#f5a142|1]] Freeze.\nNext");
  assert.equal(p.cardText("[Exhaust 2] 200%\nDefense-based Damage ."), "**Exhaust 2** 200% Defense-based Damage.");
});

test("fillPassive and wikiFile", () => {
  assert.equal(p.fillPassive("Attack +{ATK%}%", { "ATK%": [16, 18, 20] }, 2), "Attack +20%");
  // MediaWiki hashed path (checked against the wiki's own image URL)
  assert.equal(p.wikiFile("Combatant Arabella Splash Art.png"), "https://static.wikitide.net/cznwiki/9/9d/Combatant_Arabella_Splash_Art.png");
});

test("unmojibake and large modules shown as source", () => {
  assert.equal(p.unmojibake("that card\u00e2\u0080\u0099s Cost"), "that card\u2019s Cost");
  assert.equal(p.unmojibake("Café 100%"), "Café 100%");
  assert.deepEqual(p.mwJson('<div class="mw-body-content"><pre>{"Nia": [{"id": "a", "desc": "&lt;br&gt;"}]}</pre></div>'), { Nia: [{ id: "a", desc: "<br>" }] });
});

test("deckBuilderCards: categories, costs per level and English texts", () => {
  const ts = `export const X = [
    {
      id: "olga_starting_4",
      name: "断絶の裂け目",
      category: CardCategory.ATTACK,
      hiramekiVariations: [
        { level: 0, cost: 1, description: "a" },
        {
          level: 1,
          cost: 2,
          category: CardCategory.UPGRADE,
          description: "b",
        },
      ],
    },
  ];`;
  const messages = { cards: { olga_starting_4: { name: "Rift of Severance", descriptions: ["80% Damage", "140% Damage"] } } };
  assert.deepEqual(p.deckBuilderCards(ts, messages), {
    olga_starting_4: {
      name: "Rift of Severance",
      levels: [
        { level: 0, cost: 1, type: "Attack", desc: "80% Damage" },
        { level: 1, cost: 2, type: "Upgrade", desc: "140% Damage" },
      ],
    },
  });
});

test("deckBuilderCards: Japanese drafts are not used as English text", () => {
  const ts = `[\n    {\n      id: "hilde_starting_4",\n      category: CardCategory.SKILL,\n      hiramekiVariations: [{ level: 0, cost: 1, description: "x" }],\n    },\n]`;
  const r = p.deckBuilderCards(ts, { cards: { hilde_starting_4: { name: "Quiver Lord", descriptions: ["山札に生成"] } } });
  assert.equal(r.hilde_starting_4.levels[0].desc, undefined);
});
