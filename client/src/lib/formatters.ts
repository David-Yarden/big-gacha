/**
 * Format a numeric value using genshin-db format codes.
 * F1P = 1 decimal + percent, F2P = 2 decimal + percent,
 * F1 = 1 decimal, F2 = 2 decimal, I = integer, P = percent (integer)
 */
export function formatValue(value: number, format: string): string {
  switch (format) {
    case "F1P":
      return `${(value * 100).toFixed(1)}%`;
    case "F2P":
      return `${(value * 100).toFixed(2)}%`;
    case "F1":
      return value.toFixed(1);
    case "F2":
      return value.toFixed(2);
    case "I":
      return Math.round(value).toString();
    case "P":
      return `${Math.round(value * 100)}%`;
    default:
      return value.toString();
  }
}

const FLAT_STAT_TYPES = new Set(["FIGHT_PROP_ELEMENT_MASTERY", "FIGHT_PROP_HP", "FIGHT_PROP_ATTACK", "FIGHT_PROP_DEFENSE"]);

/** Format a character's ascension substat value for display. */
export function formatSpecialized(value: number, substatType?: string): string {
  if (substatType && FLAT_STAT_TYPES.has(substatType)) {
    return Math.round(value).toString();
  }
  return (value * 100).toFixed(1) + "%";
}

const MATERIAL_CATEGORY_LABELS: Record<string, string> = {
  AVATAR_MATERIAL:   "Ascension Material",
  CONSUME:           "Consumable",
  ELEM_CRYSTAL:      "Elemental Crystal",
  EXCHANGE:          "Exchange Item",
  EXP_FRUIT:         "Character EXP",
  FISH_BAIT:         "Fishing Bait",
  FISH_ROD:          "Fishing Rod",
  NOTICE_ADD_HP:     "Healing Item",
  WEAPON_EXP_STONE:  "Weapon EXP",
  WOOD:              "Wood",
  ADSORBATE:         "Adsorbate",
  NONE:              "",
};

/** Convert raw genshin-db material category codes to display names. */
export function formatMaterialCategory(category?: string): string {
  if (!category) return "";
  return MATERIAL_CATEGORY_LABELS[category] ?? category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/** Round a raw base ATK coefficient to the nearest integer for display. */
export function formatBaseAtk(value?: number): string {
  if (value == null) return "";
  return Math.round(value).toString();
}

/**
 * Parse a talent label string, replacing {paramN:FORMAT} tokens with actual values.
 * label: e.g. "1-Hit DMG|{param1:F1P}"
 * parameters: the parameters object from the talent data
 * level: 0-indexed talent level (0 = Lv.1)
 */
export function parseLabel(
  label: string,
  parameters: Record<string, number[]> | undefined,
  level: number
): { name: string; value: string } {
  const parts = label.split("|");
  const name = parts[0];
  const template = parts.slice(1).join("|");

  if (!template || !parameters) {
    return { name, value: template || "" };
  }

  const value = template.replace(
    /\{(\w+):(\w+)\}/g,
    (_match, paramKey: string, format: string) => {
      const paramValues = parameters[paramKey];
      if (!paramValues || level >= paramValues.length) return "?";
      return formatValue(paramValues[level], format);
    }
  );

  return { name, value };
}
