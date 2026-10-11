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
