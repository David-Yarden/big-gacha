/**
 * Banner history parsing helpers (no network, no database).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { _test } = require("../src/scripts/seedBanners");
const { decode, isoDate, textDate, cards, rowsWithHeadings, headingVersion } = _test;

test("dates: server time (UTC+8) to UTC", () => {
  assert.equal(isoDate("2026-09-30 11:00").toISOString(), "2026-09-30T03:00:00.000Z");
  assert.equal(isoDate("2025-09-4 11:00:00").toISOString(), "2025-09-04T03:00:00.000Z");
  assert.equal(textDate("Sep 2, 2026, 12:00").toISOString(), "2026-09-02T04:00:00.000Z");
  assert.equal(textDate("November 03, 2026", { endOfDay: true }).toISOString(), "2026-11-03T15:59:00.000Z");
  assert.equal(textDate("TBA"), undefined);
});

test("decode: entities and soft hyphens", () => {
  assert.equal(decode("Ves­na &amp; Across Time&#39;s"), "Vesna & Across Time's");
});

test("cards: rarity, linked name and label of wiki cards", () => {
  const html =
    '<div class="card-container card-rank-S mini-card"><a href="/wiki/Ellen_Joe" title="Ellen Joe"></a><div class="card-label">Ellen</div></div>' +
    '<div class="card-container mini-card"><span class="card-image-container card-quality-4 card-element-cryo"><a title="Diona"></a></span></div>';
  assert.deepEqual(cards(html), [
    { title: "Ellen Joe", label: "Ellen", rarity: 5, isChar: false },
    { title: "Diona", label: "", rarity: 4, isChar: true },
  ]);
});

test("rowsWithHeadings: rows keep the version heading above them", () => {
  const rows = rowsWithHeadings("<h2>Version 1.0</h2><table><tr><td>a</td></tr></table><h3>Version 1.1</h3><table><tr><td>b</td></tr></table>");
  assert.deepEqual(rows.map((r) => [r.html, r.version]), [["<td>a</td>", "1.0"], ["<td>b</td>", "1.1"]]);
});

test("headingVersion: numbered and Genshin \"Luna\" versions", () => {
  assert.equal(headingVersion("Version 5.8"), "5.8");
  assert.equal(headingVersion('Version "Luna I"'), "6.0");
  assert.equal(headingVersion('Version "Luna VIII"'), "6.7");
  assert.equal(headingVersion("See Also"), undefined);
});
