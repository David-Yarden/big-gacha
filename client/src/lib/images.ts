const ENKA_CDN = "https://enka.network/ui";
const AMBR_CDN = "https://api.ambr.top/assets/UI";

function enkaUrl(filename: string): string {
  return `${ENKA_CDN}/${filename}.png`;
}

export function ambrIconUrl(filename: string): string {
  return `${AMBR_CDN}/${filename}.png`;
}

// ── Elements ─────────────────────────────────────────────

const ELEMENT_ICON_FILENAMES: Record<string, string> = {
  Pyro:    "UI_ElementIcon_Fire",
  Hydro:   "UI_ElementIcon_Water",
  Anemo:   "UI_ElementIcon_Wind",
  Electro: "UI_ElementIcon_Electric",
  Dendro:  "UI_ElementIcon_Grass",
  Cryo:    "UI_ElementIcon_Ice",
  Geo:     "UI_ElementIcon_Rock",
};

export function elementIconUrl(element?: string): string | null {
  if (!element) return null;
  const filename = ELEMENT_ICON_FILENAMES[element];
  return filename ? enkaUrl(filename) : null;
}

// ── Weapon types ─────────────────────────────────────────

const WEAPON_TYPE_ICON_FILENAMES: Record<string, string> = {
  Sword:    "UI_EquipTypeIcon_Sword",
  Claymore: "UI_EquipTypeIcon_Claymore",
  Polearm:  "UI_EquipTypeIcon_Pole",
  Catalyst: "UI_EquipTypeIcon_Catalyst",
  Bow:      "UI_EquipTypeIcon_Bow",
};

export function weaponTypeIconUrl(weaponType?: string): string | null {
  if (!weaponType) return null;
  const filename = WEAPON_TYPE_ICON_FILENAMES[weaponType];
  return filename ? enkaUrl(filename) : null;
}

// ── Characters ───────────────────────────────────────────

/**
 * Small square avatar icon (head/shoulders). Used in cards.
 * Prefers Enka CDN from filename_icon — works for all characters including 4.0+.
 */
export function characterIconUrl(images?: Record<string, string>): string | null {
  if (images?.filename_icon) return enkaUrl(images.filename_icon);
  return images?.mihoyo_icon ?? null;
}

/**
 * Full-body gacha splash art (transparent PNG, portrait).
 * Prefers filename_gachaSplash via Enka — available for all characters.
 */
export function characterSplashUrl(images?: Record<string, string>): string | null {
  if (images?.filename_gachaSplash) return enkaUrl(images.filename_gachaSplash);
  return images?.cover1 ?? images?.cover2 ?? null;
}

/**
 * Side-facing icon used in team composition displays.
 */
export function characterSideIconUrl(images?: Record<string, string>): string | null {
  if (images?.filename_sideIcon) return enkaUrl(images.filename_sideIcon);
  return images?.mihoyo_sideIcon ?? null;
}

// ── Talents / Abilities ──────────────────────────────────

/**
 * Ability icon for a talent key (combat1, combat2, combat3, passive1–4).
 * talent.images has filename_combat1, filename_passive1, etc.
 */
export function talentIconUrl(
  images?: Record<string, string>,
  key: string = "combat1"
): string | null {
  const filename = images?.[`filename_${key}`];
  return filename ? enkaUrl(filename) : null;
}

// ── Constellations ───────────────────────────────────────

/**
 * Constellation icon for C1–C6 (key = "c1"..."c6").
 * constellation.images has filename_c1 ... filename_c6.
 */
export function constellationIconUrl(
  images?: Record<string, string>,
  key: string = "c1"
): string | null {
  const filename = images?.[`filename_${key}`];
  return filename ? enkaUrl(filename) : null;
}

// ── Weapons ──────────────────────────────────────────────

/**
 * Weapon icon. Uses awakened (golden) variant if available — matches in-game UI.
 * Falls back to regular icon, then mihoyo CDN.
 */
export function weaponIconUrl(images?: Record<string, string>): string | null {
  if (images?.filename_awakenIcon) return enkaUrl(images.filename_awakenIcon);
  if (images?.filename_icon) return enkaUrl(images.filename_icon);
  return images?.mihoyo_icon ?? images?.icon ?? null;
}

// ── Artifacts ────────────────────────────────────────────

/**
 * Artifact piece icon. Direct URLs are available for all pieces in all versions.
 * Falls back to Enka CDN from filename_<piece>.
 */
export function artifactIconUrl(
  images?: Record<string, string>,
  piece: string = "flower"
): string | null {
  if (images?.[piece]) return images[piece];
  const filename = images?.[`filename_${piece}`];
  return filename ? enkaUrl(filename) : null;
}

// ── Materials ────────────────────────────────────────────

export function materialIconUrl(images?: Record<string, string>): string | null {
  if (images?.filename_icon) return ambrIconUrl(images.filename_icon);
  return null;
}
