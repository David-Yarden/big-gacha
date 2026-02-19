const ENKA_CDN = "https://enka.network/ui";

function enkaUrl(filename: string): string {
  return `${ENKA_CDN}/${filename}.png`;
}


// ── Characters ───────────────────────────────────────────

/**
 * Small square avatar icon (head/shoulders). Used in cards.
 * Prefers Enka CDN from filename_icon — works for all characters including 4.0+.
 */
export function characterIconUrl(images?: Record<string, string>): string | null {
  if (images?.filename_icon) return enkaUrl(images.filename_icon);
  return images?.mihoyo_icon ?? images?.icon ?? null;
}

/**
 * Full-body gacha splash art (transparent PNG, portrait).
 * Prefers filename_gachaSplash via Enka — available for all characters.
 */
export function characterSplashUrl(images?: Record<string, string>): string | null {
  if (images?.filename_gachaSplash) return enkaUrl(images.filename_gachaSplash);
  return images?.cover1 ?? images?.cover2 ?? images?.portrait ?? images?.preview ?? null;
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

// gi.yatta.moe is the primary CDN for material icons (full version coverage).
// Enka CDN is used as a secondary fallback for items yatta doesn't carry.
const YATTA_CDN = "https://gi.yatta.moe/assets/UI";

export function materialIconUrl(images?: Record<string, string>): string | null {
  if (images?.filename_icon) return `${YATTA_CDN}/${images.filename_icon}.png`;
  return images?.icon ?? null;
}

export function materialFallbackIconUrl(images?: Record<string, string>): string | null {
  if (images?.filename_icon) return enkaUrl(images.filename_icon);
  return images?.icon ?? null;
}

/**
 * Derive material icon URL directly from the numeric item ID.
 * Genshin material IDs map 1:1 to UI_ItemIcon_{id} on the CDNs.
 */
export function materialIconUrlById(id?: number): string | null {
  if (!id) return null;
  return `${YATTA_CDN}/UI_ItemIcon_${id}.png`;
}

export function materialFallbackIconUrlById(id?: number): string | null {
  if (!id) return null;
  return enkaUrl(`UI_ItemIcon_${id}`);
}

// ── Elements ─────────────────────────────────────────────

// genshin.jmp.blue hosts element icons at /elements/{lowercase}/icon (WebP, verified 200)
const ELEMENT_SLUG: Record<string, string> = {
  Pyro:    "pyro",
  Hydro:   "hydro",
  Anemo:   "anemo",
  Electro: "electro",
  Cryo:    "cryo",
  Geo:     "geo",
  Dendro:  "dendro",
};

export function elementIconUrl(element?: string): string | null {
  if (!element) return null;
  const slug = ELEMENT_SLUG[element];
  return slug ? `https://genshin.jmp.blue/elements/${slug}/icon` : null;
}

// ── Stat Icons ───────────────────────────────────────────

// Local /stats/*.webp for base stats; element icons reused for elemental DMG bonuses.
// Elemental Mastery and Physical DMG have no dedicated icon (component falls back to Lucide).
const STAT_LOCAL: Record<string, string> = {
  FIGHT_PROP_HP:                "/stats/Icon_Attribute_Health.webp",
  FIGHT_PROP_HP_PERCENT:        "/stats/Icon_Attribute_Health.webp",
  FIGHT_PROP_ATTACK:            "/stats/Icon_Attribute_Attack.webp",
  FIGHT_PROP_ATTACK_PERCENT:    "/stats/Icon_Attribute_Attack.webp",
  FIGHT_PROP_DEFENSE:           "/stats/Icon_Attribute_Defense.webp",
  FIGHT_PROP_DEFENSE_PERCENT:   "/stats/Icon_Attribute_Defense.webp",
  FIGHT_PROP_CRITICAL:          "/stats/Icon_Attribute_Critical_Hit.webp",
  FIGHT_PROP_CRITICAL_HURT:     "/stats/Icon_Attribute_Critical_Hit.webp",
  FIGHT_PROP_CHARGE_EFFICIENCY: "/stats/Icon_Attribute_Energy_Recharge.webp",
  FIGHT_PROP_ELEMENT_MASTERY:   "/stats/Icon_Attribute_Elemental_Mastery.webp",
  FIGHT_PROP_HEAL_ADD:          "/stats/Icon_Attribute_Healing.webp",
  FIGHT_PROP_PHYSICAL_ADD_HURT: "/stats/Icon_Attribute_Physical.webp",
};

const PROP_TO_ELEMENT: Record<string, string> = {
  FIGHT_PROP_FIRE_ADD_HURT:  "Pyro",
  FIGHT_PROP_WATER_ADD_HURT: "Hydro",
  FIGHT_PROP_WIND_ADD_HURT:  "Anemo",
  FIGHT_PROP_ELEC_ADD_HURT:  "Electro",
  FIGHT_PROP_ICE_ADD_HURT:   "Cryo",
  FIGHT_PROP_ROCK_ADD_HURT:  "Geo",
  FIGHT_PROP_GRASS_ADD_HURT: "Dendro",
};

export function statIconUrl(substatType?: string): string | null {
  if (!substatType) return null;
  if (STAT_LOCAL[substatType]) return STAT_LOCAL[substatType];
  const element = PROP_TO_ELEMENT[substatType];
  if (element) return elementIconUrl(element);
  return null; // EM and Physical DMG: caller uses Lucide fallback
}

// ── Weapon Types ──────────────────────────────────────────

const WEAPON_TYPE_ICON: Record<string, string> = {
  Sword:    "/weapons/Icon_Sword.webp",
  Claymore: "/weapons/Icon_Claymore.webp",
  Polearm:  "/weapons/Icon_Polearm.webp",
  Catalyst: "/weapons/Icon_Catalyst.webp",
  Bow:      "/weapons/Icon_Bow.webp",
};

export function weaponTypeIconUrl(weaponType?: string): string | null {
  if (!weaponType) return null;
  return WEAPON_TYPE_ICON[weaponType] ?? null;
}
