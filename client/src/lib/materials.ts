export interface MaterialCostEntry {
  id: number;
  name: string;
  count: number;
  icon?: string;
}

export const ASCENSION_LEVELS = [1, 20, 40, 50, 60, 70, 80, 90] as const;

// ── Character leveling EXP ────────────────────────────────────────────────────
// Cumulative EXP required to reach level N starting from level 1.
// Index = level (1-90). Source: Genshin CharacterLevelExcelConfigData.
const CHAR_EXP_CUMULATIVE: Record<number, number> = {
   1:         0,  2:     1_000,  3:     2_325,  4:     4_025,  5:     6_175,
   6:     8_800,  7:    11_950,  8:    15_675,  9:    20_025, 10:    25_025,
  11:    30_725, 12:    37_175, 13:    44_400, 14:    52_450, 15:    61_375,
  16:    71_200, 17:    81_950, 18:    93_675, 19:   106_400, 20:   120_175,
  21:   135_050, 22:   151_850, 23:   169_850, 24:   189_100, 25:   209_650,
  26:   231_525, 27:   254_775, 28:   279_425, 29:   305_525, 30:   333_100,
  31:   362_200, 32:   392_850, 33:   425_100, 34:   458_975, 35:   494_525,
  36:   531_775, 37:   570_750, 38:   611_500, 39:   654_075, 40:   698_500,
  41:   744_800, 42:   795_425, 43:   848_125, 44:   902_900, 45:   959_800,
  46: 1_018_875, 47: 1_080_150, 48: 1_143_675, 49: 1_209_475, 50: 1_277_600,
  51: 1_348_075, 52: 1_424_575, 53: 1_503_625, 54: 1_585_275, 55: 1_669_550,
  56: 1_756_500, 57: 1_846_150, 58: 1_938_550, 59: 2_033_725, 60: 2_131_725,
  61: 2_232_600, 62: 2_341_550, 63: 2_453_600, 64: 2_568_775, 65: 2_687_100,
  66: 2_808_625, 67: 2_933_400, 68: 3_061_475, 69: 3_192_875, 70: 3_327_650,
  71: 3_465_825, 72: 3_614_525, 73: 3_766_900, 74: 3_922_975, 75: 4_082_800,
  76: 4_246_400, 77: 4_413_825, 78: 4_585_125, 79: 4_760_350, 80: 4_939_525,
  81: 5_122_700, 82: 5_338_925, 83: 5_581_950, 84: 5_855_050, 85: 6_161_850,
  86: 6_506_450, 87: 6_893_400, 88: 7_327_825, 89: 7_815_450, 90: 8_362_650,
};

/**
 * Calculate EXP books and their Mora cost to reach `targetLevel` from level 1.
 * Caps at level 90 — levels 95 and 100 don't cost additional EXP.
 * Uses greedy fill: Hero's Wit → Adventurer's Experience → Wanderer's Advice.
 * Mora cost is always totalEXPUsed / 5 (all books share the 1:5 ratio).
 */
export function calculateExpMaterials(targetLevel: number): MaterialCostEntry[] {
  const cappedLevel = Math.min(targetLevel, 90);
  const totalExp = CHAR_EXP_CUMULATIVE[cappedLevel] ?? 0;
  if (totalExp <= 0) return [];

  let remaining = totalExp;

  const heroWit   = Math.floor(remaining / 20_000); remaining -= heroWit   * 20_000;
  const advExp    = Math.floor(remaining /  5_000); remaining -= advExp    *  5_000;
  const wandAdv   = Math.ceil (remaining /  1_000); // last book may overshoot slightly

  const expUsed   = heroWit * 20_000 + advExp * 5_000 + wandAdv * 1_000;
  const moraUsed  = expUsed / 5; // always exact integer (all ratios are 1:5)

  const entries: MaterialCostEntry[] = [];
  if (heroWit > 0) entries.push({ id: 104003, name: "Hero's Wit",              count: heroWit });
  if (advExp  > 0) entries.push({ id: 104002, name: "Adventurer's Experience", count: advExp  });
  if (wandAdv > 0) entries.push({ id: 104001, name: "Wanderer's Advice",       count: wandAdv });
  if (moraUsed > 0) entries.push({ id: 202,   name: "Mora",                    count: moraUsed });

  return entries;
}

export function levelToAscensionPhase(level: number): number {
  if (level <= 20) return 0;
  if (level <= 40) return 1;
  if (level <= 50) return 2;
  if (level <= 60) return 3;
  if (level <= 70) return 4;
  if (level <= 80) return 5;
  return 6;
}

/**
 * Sum ascension materials from ascend1..ascendN up to targetPhase.
 * costs: Record<string, MaterialCostEntry[]> from character/weapon data
 */
export function calculateAscensionMaterials(
  costs: Record<string, MaterialCostEntry[]> | undefined,
  targetPhase: number
): MaterialCostEntry[] {
  if (!costs) return [];
  const merged = new Map<string, MaterialCostEntry>();

  for (let phase = 1; phase <= targetPhase; phase++) {
    const key = `ascend${phase}`;
    const items = costs[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item.name) continue;
      const existing = merged.get(item.name);
      if (existing) {
        existing.count += item.count;
      } else {
        merged.set(item.name, { ...item });
      }
    }
  }

  return Array.from(merged.values());
}

/**
 * Sum talent level-up materials from lvl2..targetLevel.
 * costs: Record<string, MaterialCostEntry[]> from talent data
 */
export function calculateTalentMaterials(
  costs: Record<string, MaterialCostEntry[]> | undefined,
  targetLevel: number
): MaterialCostEntry[] {
  if (!costs) return [];
  const merged = new Map<string, MaterialCostEntry>();

  for (let lvl = 2; lvl <= targetLevel; lvl++) {
    const key = `lvl${lvl}`;
    const items = costs[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item.name) continue;
      const existing = merged.get(item.name);
      if (existing) {
        existing.count += item.count;
      } else {
        merged.set(item.name, { ...item });
      }
    }
  }

  return Array.from(merged.values());
}

// ── Breakthrough levels (95 / 100) ───────────────────────────────────────────
// These special levels don't cost EXP or Mora — only Masterless Stella Fortuna.
// ID 0 is a placeholder (no real game entry); the icon falls back to the letter "M".
export const MASTERLESS_STELLA_FORTUNA: MaterialCostEntry & { id: 0 } = {
  id: 0,
  name: "Masterless Stella Fortuna",
  count: 1,
};

/** Selectable character levels, including the two breakthrough levels. */
export const CHARACTER_LEVELS = [1, 20, 40, 50, 60, 70, 80, 90, 95, 100] as const;

/**
 * Returns Masterless Stella Fortuna needed to reach the given breakthrough level.
 * 90 → 95: 1 copy  |  95 → 100: 2 more (3 total from 90)
 */
export function calculateBreakthroughMaterials(targetLevel: number): MaterialCostEntry[] {
  if (targetLevel < 95) return [];
  const count = targetLevel >= 100 ? 3 : 1;
  return [{ ...MASTERLESS_STELLA_FORTUNA, count }];
}

/**
 * Merge multiple material lists, summing counts for entries with the same name.
 */
export function mergeAllMaterials(
  ...lists: MaterialCostEntry[][]
): MaterialCostEntry[] {
  const merged = new Map<string, MaterialCostEntry>();

  for (const list of lists) {
    for (const item of list) {
      if (!item.name) continue;
      const existing = merged.get(item.name);
      if (existing) {
        existing.count += item.count;
      } else {
        merged.set(item.name, { ...item });
      }
    }
  }

  return Array.from(merged.values());
}
