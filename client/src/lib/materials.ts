export interface MaterialCostEntry {
  id: number;
  name: string;
  count: number;
}

export const ASCENSION_LEVELS = [1, 20, 40, 50, 60, 70, 80, 90] as const;

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
