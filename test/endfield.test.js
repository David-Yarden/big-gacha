/**
 * Endfield text helpers (no network, no database).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { _test } = require("../src/scripts/seedEndfield");
const { richText, fill, formatValue } = _test;

test("fill: blackboard values with the game's formats", () => {
  const bb = { atk_scale: 0.62, count: 4, ratio: 1.2, ignore_fire_resist: -10, dmg_taken_down: 0.85 };
  assert.equal(fill("{atk_scale:0%} x{count:0} x{ratio:0.0}", bb), "62% x4 x1.2");
  assert.equal(fill("ignores {-ignore_fire_resist:0}", bb), "ignores 10");
  assert.equal(fill("{1-dmg_taken_down:0%} DMG Reduction", bb), "15% DMG Reduction");
  assert.equal(fill("{missing:0}", bb), "?");
});

test("formatValue: decimals and percentages", () => {
  assert.equal(formatValue(0.16, "0.0%"), "16.0%");
  assert.equal(formatValue(20, "0"), "20");
  assert.equal(formatValue(1.256, "0.00"), "1.26");
});

test("richText: unknown styles become bold, tags are dropped", () => {
  assert.equal(richText("Deal <@ba.unknown>Heat DMG</> now.<br>"), "Deal **Heat DMG** now.");
  assert.equal(richText("Line 1\\nLine 2"), "Line 1\nLine 2");
});
