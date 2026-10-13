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

test("czn: divine epiphany text (every line) and rules", () => {
  assert.equal(p.epiphanyText("Increase Heal Amount by 100%\nApply Finale to this card\nNIHILUM\nUNIQUE\nSkill"), "Increase Heal Amount by 100%\nApply Finale to this card");
  assert.equal(p.epiphanyText("Reduce Cost of this card by 1\n1\n2\n3\n4+\n@?#$\nUNIQUE\nAttack"), "Reduce Cost of this card by 1");
  assert.equal(p.epiphanyText("If 8 or more cards are in hand, change Cost to\n0\n1\n2\nDIALLOS\nUNIQUE\nSkill"), "If 8 or more cards are in hand, change Cost to 0");
  // The classes listed under a common epiphany are not part of its text
  assert.equal(p.epiphanyText("For 1 turn, gain 1 Morale\nStriker\nPsionic\nController"), "For 1 turn, gain 1 Morale");
  assert.deepEqual(p.epiphanyRules("Gain 1 AP", []), { requires: undefined, costs: ["0"] });
  assert.deepEqual(p.epiphanyRules("Increase Heal Amount of this card by 30%", []), { requires: ["cure"], costs: [] });
  assert.deepEqual(p.epiphanyRules("Draw 1", []).requires, ["draw"]);
  assert.deepEqual(p.epiphanyRules("One random ally performs Coordinated Attack to the target", []).requires, ["targetable"]);
  assert.equal(p.epiphanyRules("Draw 1 card(s) of this unit", []).requires, undefined);
});

test("czn: divine epiphany pools match the in-game probability screens", () => {
  const table = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "../src/scripts/cznDivine.json"), "utf8"));
  // Arabella – Scream For Me: Attack, 1 cost, hits all enemies → 49 effects (2.04082 % each)
  const scream = p.divinePool(table, { type: "Attack", cost: 1, tags: new Set() });
  assert.equal(scream.length, 49);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, scream.filter((e) => e.god === g).length])),
    { Nihilum: 8, Diallos: 8, Sekred: 7, Kyrken: 8, Vytor: 9, Caligo: 9 }
  );
  // Arabella – Hollow Verdict II (an epiphany, unique card): Attack, 1 cost, all enemies → same 49 as Scream For Me
  assert.equal(p.divinePool(table, { name: "Hollow Verdict", type: "Attack", cost: 1, tags: new Set() }).length, 49);
  // Arabella – Sadistic Restraint V: Attack, 1 cost, one target (Coordinated Attack) → 55 (1.81818 % each)
  const restraintV = p.divinePool(table, { name: "Sadistic Restraint V", type: "Attack", cost: 1, tags: new Set(["targetable"]) });
  assert.equal(restraintV.length, 55);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, restraintV.filter((e) => e.god === g).length])),
    { Nihilum: 9, Diallos: 9, Sekred: 8, Kyrken: 9, Vytor: 10, Caligo: 10 }
  );
  // Sadistic Restraint II: same but draws (no draw effect); it already had Reduce Cost → 47 shown
  const restraint = p.divinePool(table, { name: "Sadistic Restraint II", type: "Attack", cost: 1, tags: new Set(["targetable", "draw"]) }).filter(
    (e) => e.text !== "Reduce Cost of this card by 1"
  );
  assert.equal(restraint.length, 47);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, restraint.filter((e) => e.god === g).length])),
    { Nihilum: 8, Diallos: 8, Sekred: 6, Kyrken: 8, Vytor: 8, Caligo: 9 }
  );
  // Arabella – Observer's Pleasure I: Skill, 0 cost, no heal / shield / draw / target → 13 shown (7.69231 % each)
  // + "Draw 1" of every god, that the card already had (the screen leaves out what the card has)
  const pleasure = p.divinePool(table, { name: "Observer’s Pleasure", type: "Skill", cost: 0, tags: new Set() });
  assert.equal(pleasure.filter((e) => e.text !== "Draw 1").length, 13);
  assert.equal(pleasure.filter((e) => e.text === "Draw 1").length, 6);
  // Hilde – Draw & Release: Skill, 1 cost, already draws (no draw effect) → 14 (7.14286 % each)
  const release = p.divinePool(table, { name: "Draw & Release", type: "Skill", cost: 1, tags: new Set(["draw"]) });
  assert.equal(release.length, 14);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, release.filter((e) => e.god === g).length])),
    { Nihilum: 3, Diallos: 2, Sekred: 1, Kyrken: 3, Vytor: 2, Caligo: 3 }
  );
  // Mika – Source of Water: Skill, 0 cost, heals → 21 shown (4.76190 % each) + the Draw 1 it already had
  const water = p.divinePool(table, { name: "Source of Water", type: "Skill", cost: 0, tags: new Set(["cure"]) });
  const shown = water.filter((e) => e.text !== "Draw 1");
  assert.equal(shown.length, 21);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, shown.filter((e) => e.god === g).length])),
    { Nihilum: 4, Diallos: 3, Sekred: 4, Kyrken: 3, Vytor: 4, Caligo: 3 }
  );
  // Hilde – Big Game Ranger IV: Upgrade, 1 cost, no draw → 22 (4.54545 % each); Morale/Resolve
  // for every god, Sekred's Mark only on Upgrades
  const ranger = p.divinePool(table, { name: "Big Game Ranger IV", type: "Upgrade", cost: 1, tags: new Set() });
  assert.equal(ranger.length, 22);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, ranger.filter((e) => e.god === g).length])),
    { Nihilum: 4, Diallos: 3, Sekred: 4, Kyrken: 4, Vytor: 3, Caligo: 4 }
  );
  assert.ok(!release.some((e) => /Mark to a random enemy/.test(e.text)));
  // Fei – Soulfire Dance IV: Skill, X cost (counts as 0), draws, Coordinated Attack offered → 17
  // (5.88235 % each): Gain 1 AP, no Reduce Cost / Cost 0-3 / Harmonization / Combo
  // (no "the target", but "X Flame Arts × 2": several hits, a targeted card)
  const soulfire = p.divinePool(table, { name: "Soulfire Dance IV", type: "Skill", cost: -1, tags: new Set(["draw", "targetable"]) });
  assert.equal(soulfire.length, 17);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, soulfire.filter((e) => e.god === g).length])),
    { Nihilum: 3, Diallos: 3, Sekred: 2, Kyrken: 3, Vytor: 3, Caligo: 3 }
  );
  assert.ok(soulfire.some((e) => e.text === "Gain 1 AP") && !soulfire.some((e) => /Reduce Cost of this card/.test(e.text)));
  // Fei – Soulfire Dance II: Attack, X cost (0), one target → 51 (1.96078 % each); no Fortitude −2
  const soulfire2 = p.divinePool(table, { name: "Soulfire Dance II", type: "Attack", cost: -1, tags: new Set(["targetable"]) });
  assert.equal(soulfire2.length, 51);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, soulfire2.filter((e) => e.god === g).length])),
    { Nihilum: 8, Diallos: 9, Sekred: 8, Kyrken: 8, Vytor: 9, Caligo: 9 }
  );
  // Cassius – Devil Dice V: Attack, 0 cost, hits all enemies (no target), draws → 43 (2.32558 % each):
  // no Coordinated Attack, no draw effect, no Fortitude −2 (cost 0)
  const dice = p.divinePool(table, { name: "Devil Dice V", type: "Attack", cost: 0, tags: new Set(["draw"]) });
  assert.equal(dice.length, 43);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, dice.filter((e) => e.god === g).length])),
    { Nihilum: 7, Diallos: 8, Sekred: 6, Kyrken: 7, Vytor: 7, Caligo: 8 }
  );
  // Maribell – Oh... I see. II: Skill, 1 cost, gives a Shield → 29 (3.44828 % each): Shield +30 %
  // for every god, Diallos' "If no Shield is present…"
  const isee = p.divinePool(table, { name: "Oh... I see. II", type: "Skill", cost: 1, tags: new Set(["shield"]) });
  assert.equal(isee.length, 29);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, isee.filter((e) => e.god === g).length])),
    { Nihilum: 5, Diallos: 5, Sekred: 4, Kyrken: 5, Vytor: 5, Caligo: 5 }
  );
  // Heidemarie – Sword Rain III: Skill, 1 cost, "against the target" → Coordinated Attack; 22 shown
  // (4.54545 % each) + the Draw 1 it already had
  const rain = p.divinePool(table, { name: "Sword Rain III", type: "Skill", cost: 1, tags: new Set(["targetable"]) });
  const rainShown = rain.filter((e) => e.text !== "Draw 1");
  assert.equal(rainShown.length, 22);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, rainShown.filter((e) => e.god === g).length])),
    { Nihilum: 4, Diallos: 3, Sekred: 3, Kyrken: 4, Vytor: 4, Caligo: 4 }
  );
  // Neutral card Attack!: Skill, 0 cost, takes an Attack card from the Draw Pile to hand (a draw)
  // → 11 (9.09091 % each): no draw effect, Caligo still offers "Treated as a Neutral Card"
  const attack = p.divinePool(table, { name: "Attack!", type: "Skill", cost: 0, tags: new Set(["draw"]) });
  assert.equal(attack.length, 11);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, attack.filter((e) => e.god === g).length])),
    { Nihilum: 2, Diallos: 2, Sekred: 1, Kyrken: 2, Vytor: 2, Caligo: 2 }
  );
  // Magna – Ice Wall III: Upgrade, 2 cost, gives a Shield → 21 (4.76190 % each): no Shield +30 % nor
  // Diallos' shield effect (Skills only), no Combo (1-cost cards only)
  const wall = p.divinePool(table, { name: "Ice Wall III", type: "Upgrade", cost: 2, tags: new Set(["shield"]) });
  assert.equal(wall.length, 21);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, wall.filter((e) => e.god === g).length])),
    { Nihilum: 4, Diallos: 3, Sekred: 4, Kyrken: 4, Vytor: 3, Caligo: 3 }
  );
  // Mika – Whirlpool II: Attack, 1 cost, all enemies, its base heals → 49; 43 shown (2.32558 % each)
  // + the Agony it already had: no heal effect on an Attack, Fortitude −2 and Combo at cost 1
  const whirl = p.divinePool(table, { name: "Whirlpool II", type: "Attack", cost: 1, tags: new Set(["cure"]) });
  assert.equal(whirl.length, 49);
  assert.equal(whirl.filter((e) => e.text !== "4 Agony to the target").length, 43);
  assert.ok(!whirl.some((e) => /Heal/.test(e.text)));
  // Magna – Ice Wall I: Skill, 2 cost, Shield → 28 (3.57143 % each): no Combo at 2 cost
  const wall1 = p.divinePool(table, { name: "Ice Wall I", type: "Skill", cost: 2, tags: new Set(["shield"]) });
  assert.equal(wall1.length, 28);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, wall1.filter((e) => e.god === g).length])),
    { Nihilum: 5, Diallos: 5, Sekred: 4, Kyrken: 5, Vytor: 5, Caligo: 4 }
  );
  // Mika – Blessing of Waves I: Skill, 1 cost, heals, already has Retain → 29 (3.44828 % each):
  // the three heal effects, no "Apply Retain" for a card that has it
  const waves = p.divinePool(table, { name: "Blessing of Waves I", type: "Skill", cost: 1, tags: new Set(["cure"]), keywords: new Set(["Retain"]) });
  assert.equal(waves.length, 29);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, waves.filter((e) => e.god === g).length])),
    { Nihilum: 6, Diallos: 3, Sekred: 5, Kyrken: 5, Vytor: 5, Caligo: 5 }
  );
  // Nine – Hew (Massacre): Attack, 3 cost, all enemies, already has Initiation → 48 (2.08333 % each):
  // Cost 0-3 and Harmonization still at cost 3, Kyrken's "Decrease Stress by 5", no Initiation, no Combo (Stress −5: it has Exhaust)
  const hew = p.divinePool(table, { name: "Hew (Massacre)", type: "Attack", cost: 3, tags: new Set(), keywords: new Set(["Unique", "Initiation", "Exhaust", "Ephemeral"]) });
  assert.equal(hew.length, 48);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, hew.filter((e) => e.god === g).length])),
    { Nihilum: 8, Diallos: 8, Sekred: 7, Kyrken: 9, Vytor: 8, Caligo: 8 }
  );
  // Heidemarie – Thread of Light IV: Skill, 3 cost, no target in its text (base: a targeted Attack)
  // → 22; 21 shown (4.76190 % each) + the Draw 2 of Sekred it already had: no Coordinated Attack,
  // Kyrken's Stress −5 (it has Exhaust)
  const thread = p.divinePool(table, { name: "Thread of Light IV", type: "Skill", cost: 3, tags: new Set(), keywords: new Set(["Linked", "Exhaust"]) });
  assert.equal(thread.length, 22);
  assert.ok(!thread.some((e) => /Coordinated/.test(e.text)) && thread.some((e) => e.text === "Decrease Stress by 5"));
  // Fei – Soulfire Dance V: Upgrade, 2 cost (shown 1 with its Reduce Cost divine; not X) → 21;
  // 15 shown (6.66667 % each) + the Reduce Cost it had: Flame Arts is not a draw
  const sfv = p.divinePool(table, { name: "Soulfire Dance V", type: "Upgrade", cost: 2, tags: new Set(), keywords: new Set(["Unique"]) });
  assert.equal(sfv.length, 21);
  assert.equal(sfv.filter((e) => !/Reduce Cost/.test(e.text)).length, 15);
  // Fei – Night Rain II and V: Skill, 0 cost, gain Flame Arts (counts as a draw) → 11
  // (9.09091 % each; II showed 5 + the Gain 1 AP it had): no draw effect, no Coordinated Attack
  const rain2 = p.divinePool(table, { name: "Night Rain V", type: "Skill", cost: 0, tags: new Set(["draw"]) });
  assert.equal(rain2.length, 11);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, rain2.filter((e) => e.god === g).length])),
    { Nihilum: 2, Diallos: 2, Sekred: 1, Kyrken: 2, Vytor: 2, Caligo: 2 }
  );
  // Maribell – Resolute Blitz I (site tiers cznmetadecks.com): Attack, 1 cost, targeted, already
  // has Pulverize → 54: no Pulverize, Coordinated Attack, Combo
  const blitz = p.divinePool(table, { name: "Resolute Blitz I", type: "Attack", cost: 1, tags: new Set(["targetable"]), keywords: new Set(["Pulverize"]) });
  assert.equal(blitz.length, 54);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, blitz.filter((e) => e.god === g).length])),
    { Nihilum: 9, Diallos: 8, Sekred: 8, Kyrken: 9, Vytor: 10, Caligo: 10 }
  );
  assert.ok(!blitz.some((e) => /Pulverize/.test(e.text)));
  // Finale cards get neither Sekred's Draw 2 nor Combo (site tiers)
  const finale = p.divinePool(table, { name: "a Finale card", type: "Attack", cost: 1, tags: new Set(["targetable"]), keywords: new Set(["Finale"]) });
  assert.ok(!finale.some((e) => /Draw 2|Combo/.test(e.text)));
  // Mika – Whirlpool IV (site tiers): Attack, 4 cost, all enemies → 48: Cost 0-3 and Harmonization
  // at 4 cost, no Stress −5 (no Exhaust), no Combo, no Coordinated Attack
  const whirl4 = p.divinePool(table, { name: "Whirlpool IV", type: "Attack", cost: 4, tags: new Set() });
  assert.equal(whirl4.length, 48);
  assert.ok(!whirl4.some((e) => /Stress|Combo|Coordinated/.test(e.text)));
  assert.ok(whirl4.some((e) => /Harmonization/.test(e.text)) && whirl4.some((e) => /0-3/.test(e.text)));
  // Khalipe – Vulture Ejection I: Attack, 3 cost, all enemies, Retain, no Exhaust → 47 (2.12766 % each):
  // no Stress −5 (it needs Exhaust, not 3 cost), no Retain, no Coordinated Attack
  const vulture = p.divinePool(table, { name: "Vulture Ejection I", type: "Attack", cost: 3, tags: new Set(), keywords: new Set(["Celestial", "Retain"]) });
  assert.equal(vulture.length, 47);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, vulture.filter((e) => e.god === g).length])),
    { Nihilum: 8, Diallos: 7, Sekred: 7, Kyrken: 8, Vytor: 9, Caligo: 8 }
  );
  // Mika – Tactical Analysis V (site tiers): Upgrade, 0 cost → 19: Gain 1 AP and Morale/Resolve from
  // every god, Sekred's Mark, no Reduce Cost, no Harmonization, no Cost 0-3
  const tactic = p.divinePool(table, { name: "Tactical Analysis V", type: "Upgrade", cost: 0, tags: new Set(["cure"]) });
  assert.equal(tactic.length, 19);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, tactic.filter((e) => e.god === g).length])),
    { Nihilum: 3, Diallos: 3, Sekred: 4, Kyrken: 3, Vytor: 3, Caligo: 3 }
  );
  // Mika – Source of Water V (site tiers: "Targets Exhaust"): Skill, 0 cost, heals, Exhaust → 28,
  // Kyrken's Stress −5 at 0 cost
  const water5 = p.divinePool(table, { name: "Source of Water V", type: "Skill", cost: 0, tags: new Set(["cure"]), keywords: new Set(["Exhaust"]) });
  assert.equal(water5.length, 28);
  assert.deepEqual(
    Object.fromEntries(table.gods.map((g) => [g, water5.filter((e) => e.god === g).length])),
    { Nihilum: 5, Diallos: 4, Sekred: 5, Kyrken: 5, Vytor: 5, Caligo: 4 }
  );
  // A cheap card with Exhaust gets it
  const exhaust = p.divinePool(table, { name: "an Exhaust card", type: "Skill", cost: 0, tags: new Set(), keywords: new Set(["Exhaust"]) });
  assert.ok(exhaust.some((e) => e.text === "Decrease Stress by 5"));
});

test("officialName: the game's spelling of a community card name", () => {
  const names = ["Counterattack Preparation", "Heavenly Judgment", "Judgment", "Forbidden: Guidance of Futility", "Guidance of Futility", "Acid Gas​", "Rake", "Make"];
  assert.equal(p.officialName("Counterattack Preperation", names), "Counterattack Preparation");
  assert.equal(p.officialName("Heavenly Judgement", names), "Heavenly Judgment");
  assert.equal(p.officialName("Judgement", names), "Judgment");
  assert.equal(p.officialName("Forbidden: Guidance of Falling", names), "Forbidden: Guidance of Futility");
  assert.equal(p.officialName("Acid Gas", names), "Acid Gas");
  // Short names: no guess
  assert.equal(p.officialName("Bake", names), "Bake");
  assert.equal(p.officialName("New Card", names), "New Card");
});

test("sameEquipmentName: shortened or one letter off, same words", () => {
  assert.ok(p.sameEquipmentName("Twin Swords of Greater and Lesser Evil", "Twin Swords of Great and Lesser Evil"));
  assert.ok(p.sameEquipmentName("Unexploded Plasma Bomb", "Unexploded Plasma Bomber"));
  assert.ok(p.sameEquipmentName("Vladeus Reactor", "Viadeus’s Reactor"));
  assert.ok(p.sameEquipmentName("Command 108", "Command: #108"));
  assert.ok(!p.sameEquipmentName("Titan Combat Suit", "Light Combat Suit"));
});

test("fillValues: the game's text with the community's numbers", () => {
  assert.equal(p.fillValues("On Ravage, X% Fixed Shield", "Fixed shield 60% when wrecked"), "On Ravage, 60% Fixed Shield");
  assert.equal(p.fillValues("On Critical Hit, 50% chance to X Agony", "When attacking Consciousness, 50% chance to cause Pain to the target 1"), "On Critical Hit, 50% chance to 1 Agony");
  assert.equal(p.fillValues("+X% Damage Amount, +X Shield gain", "+20% Damage, +20% Shield Acquisition"), "+20% Damage Amount, +20 Shield gain");
  // Percentages alone when other numbers are left over
  assert.equal(p.fillValues("At the start of the second turn, X% Fixed Shield", "200% fixed shield at the start of the next turn after 2 turns of combat"), "At the start of the second turn, 200% Fixed Shield");
  assert.equal(p.fillValues("When taking Damage, $RecoverXrev_0_0#% of Max HP (1 time per turn)", "Recover 5% of max HP when taking damage"), "When taking Damage, Recover 5% of Max HP (1 time per turn)");
  assert.equal(p.fillValues("+20% Critical Damage", "+12% Lucky Hit Damage"), "+20% Critical Damage");
  assert.equal(p.fillValues("X is applied as X+X", "apply x as x +1"), null);
  assert.equal(p.fillValues("Increase Tenacity Damage by X%", "Pain 3 on cards costing 2"), null);
  assert.equal(p.fillValues("RecoverXrev_0_0Xrev_1_0#%Fixed Shield$", "Recover 10%"), null);
});

test("officialTerms: the game's terms in a machine-translated text", () => {
  assert.equal(p.officialTerms("When attacked, inflict one random effect on the attacker among Pain, Vulnerable, and Burn"), "When attacked, inflict one random effect on the attacker among Agony, Vulnerable, and Scorched");
  assert.equal(p.officialTerms("+20% damage to targets with pain"), "+20% damage to targets with Agony");
  assert.equal(p.officialTerms("10% ATK, -5% heart rate"), "10% Attack, -5% Critical Chance");
  assert.equal(p.officialTerms("+18% Atk. Reduce allied stress by 1 when wrecking"), "+18% Attack. Reduce allied stress by 1 on Ravage");
  assert.equal(p.officialTerms("When storing or extinguishing a card, deal 100% fixed damage"), "When storing or Exhausting a card, deal 100% Fixed Damage");
  assert.equal(p.officialTerms("Counter 3. On counterattack, 2 Counter Surge"), "Counterattack 3. On counterattack, 2 Counter Surge");
  assert.equal(p.officialTerms("At the start of the fight, Save 1. Save 20% Shield"), "At the start of the fight, Stockpile 1. Save 20% Shield");
});

test("cardText: keywords with or without spaces in the brackets", () => {
  assert.equal(p.cardText("[ Lead ] 100% Shield. [Unique]"), "**Lead** 100% Shield. **Unique**");
});

test("currentWording: the game now writes Proc where older texts say Activate", () => {
  assert.equal(p.currentWording("Activate 5 Effulgent Blade in Graveyard against the target as an Extra Attack."), "Proc 5 Effulgent Blade in Graveyard against the target as an Extra Attack.");
  assert.equal(p.currentWording("At the start of the turn, activate Hew in hand 1 time(s)."), "At the start of the turn, proc Hew in hand 1 time(s).");
  assert.equal(p.currentWording("When this card is the first card activated, Draw 2"), "When this card is the first card activated, Draw 2");
});

test("commonRows / commonPool: the game's three pools of common epiphanies", () => {
  const rules = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "../src/scripts/cznCommon.json"), "utf8"));
  // A small copy of the hub's list: blocks of one row per cost, the first row ("1,2,3,4+") is the 0-cost row
  let n = 0;
  const row = (text, types, levels, classes) => ({ id: `com_${String(++n).padStart(4, "0")}`, text, types, levels, classes });
  const AS = ["Attack", "Skill"];
  const all = ["1", "2", "3", "4+"];
  const block = (texts, types, classes, withZero = true) =>
    (withZero ? [all, ["1"], ["2"], ["3"], ["4+"]] : [["1"], ["2"], ["3"], ["4+"]]).map((lv, i) => row(texts[i], types, lv, classes));
  const VS = ["Vanguard", "Striker"];
  const CO = ["Vanguard", "Ranger", "Hunter", "Controller"];
  const rows = [
    ...block(["Morale 1", "Morale 1", "Morale 2", "Morale 2", "Morale 2"], AS, ["Controller", "Psionic", "Striker"]),
    ...block(["For 1 turn, gain 1 Morale", "For 1 turn, gain 2 Morale", "For 1 turn, gain 3 Morale", "For 1 turn, gain 4 Morale", "For 1 turn, gain 3 Morale"], AS, ["Controller", "Psionic", "Striker"]),
    ...block(["Apply 2 Vulnerable to the target", "Apply 2 Vulnerable to the target", "Apply 3 Vulnerable to the target", "Apply 3 Vulnerable to the target", "Apply 3 Vulnerable to the target"], AS, VS),
    ...block(["Apply 1 Vulnerable to the target", "Apply 1 Vulnerable to the target", "Apply 2 Vulnerable to the target", "Apply 2 Vulnerable to the target", "Apply 2 Vulnerable to the target"], AS, VS),
    ...block(["Gain 1 AP", "Gain 1 AP", "Gain 2 AP", "Gain 2 AP", "Gain 2 AP"], AS, CO),
    ...block(["Reduce Cost of this card by 1", "Reduce Cost of this card by 1", "Reduce Cost of this card by 1", "Reduce Cost of this card by 1"], ["Upgrade"], VS, false),
    row("Gain 1 AP", AS, ["2"], CO),
    row("Gain 1 AP", AS, ["3"], CO),
    row("Gain 1 AP", AS, ["4+"], CO),
    // copies at the end of the list
    row("Apply 2 Vulnerable to the target", AS, ["3"], VS),
    row("Gain 1 AP", AS, ["3"], CO),
  ];
  const entries = p.commonRows(rows, rules);
  const pool = (type, cost, cls, tags = []) => p.commonPool(entries, { type, cost, cls, tags: new Set(tags) }).map((e) => e.text);
  // Sadistic Restraint (Striker Attack 1, targeted): the low block, Morale for 1 turn
  assert.deepEqual(pool("Attack", 1, "Striker", ["targetable"]), ["For 1 turn, gain 2 Morale", "Apply 1 Vulnerable to the target"]);
  // 0 cost: the first row of a block (Observer's Pleasure: 1 Morale for 1 turn)
  assert.deepEqual(pool("Skill", 0, "Striker"), ["For 1 turn, gain 1 Morale"]);
  // Hew (Attack 3): the low block, copies left out; no Gain AP at 1 cost (Plasma Rain), 1 at 2+ (Whirlpool)
  assert.deepEqual(pool("Attack", 3, "Vanguard", ["targetable"]), ["Apply 2 Vulnerable to the target", "Gain 1 AP"]);
  assert.deepEqual(pool("Attack", 1, "Controller"), ["For 1 turn, gain 2 Morale"]);
  // A Skill with Exhaust (Shuffle, Controller Skill 1): permanent Morale, the high block of Gain AP
  assert.deepEqual(pool("Skill", 1, "Controller", ["exhaust"]), ["Morale 1", "Gain 1 AP"]);
  // No Reduce Cost on Upgrades (Big Game Ranger)
  assert.deepEqual(pool("Upgrade", 1, "Striker"), []);
  // The game's wording
  const agony = p.commonRows([row("Apply 2 Agony to the target", AS, all, ["Psionic"])], rules);
  assert.equal(agony[0].text, "2 Agony to the target");
});

test("applyScreens: the game's wording from in-game screenshots replaces the card's texts", () => {
  const screens = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "../src/scripts/cznTexts.json"), "utf8")).screens;
  // Hew: the game files give no epiphanies, the screen names its five
  const hew = p.applyScreens({ name: "Hew", cost: 3, type: "Attack", desc: "350% Defense-Based Damage." }, screens);
  assert.deepEqual(hew.epiphanies.map((e) => e.name), ["Hew (Ironclad)", "Hew (Extreme)", "Hew (Flash)", "Hew (Massacre)", "Hew (Ambush)"]);
  assert.equal(hew.desc, "350% Defense-Based Damage.");
  assert.match(hew.epiphanies[1].desc, /^\*\*Unique\*\* .* 300% Defense-Based Damage\./);
  // Ice Wall: the texts by level, the rest of each epiphany kept
  const ice = p.applyScreens({ name: "Ice Wall", cost: 2, type: "Skill", desc: "x", epiphanies: [{ level: 2, name: "Ice Wall II", cost: 2, type: "Skill", desc: "old" }] }, screens);
  assert.equal(ice.epiphanies.find((e) => e.level === 2).desc, "300% Shield. 2 Counterattack. +30% Shield Gain Amount for each Counterattack of this unit.");
  assert.equal(ice.epiphanies.length, 5);
  // A card without screenshots is left as it is
  const other = { name: "Slash", desc: "100% Damage." };
  assert.equal(p.applyScreens(other, screens), other);
});

test("fragmentBuild: the game's recommended Memory Fragments with the game's names", () => {
  const table = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "../src/scripts/cznFragments.json"), "utf8"));
  const sets = { 7: "Tetra's Authority", 8: "Healer's Journey", 10: "Seth's Scarab" };
  const raw = p.pyLiteral(
    '_RAW: dict[int, dict] = {\n    1039: {\n        "sets": [7, 8, 10],\n        "main_4": [\'HP%\'],\n        "main_5": [\'HP%\', \'DEF%\'],\n        "main_6": [\'Ego\', \'DEF%\', \'HP%\'],\n        "substats": [\'Flat DEF\', \'DEF%\', \'Flat HP\', \'HP%\', \'Ego\'],\n    },\n}\n',
    "_RAW"
  );
  const b = p.fragmentBuild(raw["1039"], sets, table);
  assert.deepEqual(b.sets, [{ label: "Sets", names: ["Tetra's Authority", "Healer's Journey", "Seth's Scarab"] }]);
  // Defense % is not a main option of Desire in the game's table: left out
  assert.deepEqual(b.slots, [
    { slot: "IV · Ideal", stats: ["Health %"] },
    { slot: "V · Desire", stats: ["Health %"] },
    { slot: "VI · Imagination", stats: ["Ego Recovery", "Defense %", "Health %"] },
  ]);
  assert.deepEqual(b.substats, ["Defense +", "Defense %", "Health +", "Health %", "Ego Recovery"]);
  assert.equal(p.fragmentBuild(undefined, sets, table), undefined);
});
