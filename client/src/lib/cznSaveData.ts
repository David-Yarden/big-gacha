/**
 * Chaos Zero Nightmare Save Data ("Faint Memory") points of a deck, with the rules of the
 * developer note of 2026-01-26 (Season 2):
 *   - a combatant's 8 cards (starting + unique) and their epiphanies: 0
 *   - neutral card 20 (an epiphany on it adds nothing since Season 2)
 *   - monster card: Common 20, Rare 50, Legendary 80
 *   - forbidden, season, Persona and event cards 20 (they count as forbidden cards)
 *   - divine epiphany 20, on any card but the 3 basic cards (no epiphany)
 *   - copies: 1st and 2nd 0, 3rd and 4th 40 each (4 at most)
 *   - removing a starting card 20, any other card 0 (5 removals at most)
 *   - equipment: refinement 10, God's Hammer 10 (per piece)
 * Cap: 30 at Chaos tier 1, +10 per tier, up to tier 16 (180).
 */

export const MAX_COPIES = 4;
export const MAX_REMOVALS = 5;
export const MAX_TIER = 16;
export const capOf = (tier: number) => 30 + 10 * (Math.min(MAX_TIER, Math.max(1, tier)) - 1);

const MONSTER_POINTS: Record<string, number> = { Common: 20, Rare: 50, Legendary: 80 };
/** Points to keep a card that is not a combatant's, by card group (Reference "Cards"). */
const GROUP_POINTS: Record<string, number> = {
  Neutral: 20,
  Forbidden: 20,
  Persona: 20,
  "Season 1": 20,
  "Season 2": 20,
  "Season 3": 20,
  Season: 20,
  Event: 20,
  Arena: 20,
  Curse: 0,
};
/** Groups whose cost is a guess (no source says it) */
export const UNSURE_GROUPS = new Set(["Arena", "Curse"]);

export interface SaveCard {
  name: string;
  source: "kit" | "extra";
  /** Kit cards: "start" / "unique" */
  kind?: string;
  /** A starting card that can take no epiphany */
  basic?: boolean;
  /** Extra cards: the group (Neutral, Monster…) and a monster's grade */
  group?: string;
  rarity?: string;
  divine?: boolean;
  copied?: boolean;
}
export interface SaveRemoved {
  name: string;
  owner: string;
  kind: string;
}
export interface SaveEquipment {
  slot: string;
  name: string;
  refinement: boolean;
  hammer: boolean;
}
export interface SaveLine {
  label: string;
  points: number;
  note?: string;
  unsure?: boolean;
}

export function saveData(cards: SaveCard[], removed: SaveRemoved[], equipment: SaveEquipment[], tier: number) {
  const lines: SaveLine[] = [];

  // Cards kept
  for (const c of cards) {
    if (c.copied) continue; // counted with the copies
    if (c.source === "extra") {
      const unsure = UNSURE_GROUPS.has(c.group ?? "");
      if (c.group === "Monster") lines.push({ label: c.name, points: MONSTER_POINTS[c.rarity ?? ""] ?? 20, note: `Monster card${c.rarity ? ` · ${c.rarity}` : " · grade unknown"}`, unsure: !c.rarity });
      else lines.push({ label: c.name, points: GROUP_POINTS[c.group ?? ""] ?? 20, note: `${c.group ?? "Neutral"} card`, unsure });
    }
    if (c.divine && !c.basic) lines.push({ label: c.name, points: 20, note: "Divine Epiphany" });
  }

  // Copies: the first two are free, then 40 each
  const copies = cards.filter((c) => c.copied);
  copies.forEach((c, i) => {
    lines.push({ label: c.name, points: i < 2 ? 0 : 40, note: `Copy ${i + 1}` });
    if (c.divine && !c.basic) lines.push({ label: c.name, points: 20, note: "Divine Epiphany (copy)" });
  });

  // Removals: a starting card costs 20, any other nothing
  for (const r of removed) lines.push({ label: r.name, points: r.kind === "start" ? 20 : 0, note: `Removed ${r.kind === "start" ? "starting" : "unique"} card · ${r.owner}` });

  // Equipment
  for (const e of equipment) {
    if (e.refinement) lines.push({ label: e.name, points: 10, note: "Refinement" });
    if (e.hammer) lines.push({ label: e.name, points: 10, note: "God's Hammer" });
  }

  const total = lines.reduce((s, l) => s + l.points, 0);
  const cap = capOf(tier);
  return {
    total,
    cap,
    over: total > cap,
    lines: lines.filter((l) => l.points > 0 || l.note?.startsWith("Copy") || l.note?.startsWith("Removed")),
    copies: copies.length,
    removals: removed.length,
    tooManyCopies: copies.length > MAX_COPIES,
    tooManyRemovals: removed.length > MAX_REMOVALS,
  };
}
