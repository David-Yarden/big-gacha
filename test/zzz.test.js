/**
 * ZZZ text and formula helpers (no network, no database).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { _test } = require("../src/scripts/seedZzz");
const { cleanText, skillValue, fixedValue } = _test;

test("cleanText: game markup to the site's format", () => {
  const s = cleanText("Press <IconMap:Icon_Normal> to deal <color=#2EB6FF>Electric DMG</color> and <color=#FFFFFF>Daze</color> <color=#2BAD00>32%</color>.");
  assert.equal(s, "Press [[key:Basic Attack|https://enka.network/ui/zzz/IconRoleSkillKeyNormal.png]] to deal [[#2EB6FF|Electric DMG]] and **Daze** **32%**.");
  assert.equal(cleanText("<i>Note</i>\\nnext"), "Note\nnext");
});

test("skillValue: base + growth per level, arithmetic on several skills", () => {
  const rows = new Map([[1, [3120, 290, 1560, 80]], [2, [1000, 100, 0, 0]]]);
  assert.equal(skillValue("{Skill:1, Prop:1001}", 1, rows), "31.2%");
  assert.equal(skillValue("{Skill:1, Prop:1002}", 12, rows), "24.4%");
  assert.equal(skillValue("{{Skill:1, Prop:1001} + {Skill:2, Prop:1001}}", 1, rows), "41.2%");
  assert.equal(skillValue("{Skill:9, Prop:1001}", 1, rows), null);
});

test("fixedValue: CAL formulas use the skill level", () => {
  assert.equal(fixedValue("{CAL:8+AvatarSkillLevel(1)*1,1,2}%", 12), "20%");
  assert.equal(fixedValue("60", 3), "60");
});
