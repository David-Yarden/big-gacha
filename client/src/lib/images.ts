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

/**
 * Derive HSR material icon URL from the numeric item ID.
 * HSR material IDs map to icon/item/{id}.png on StarRailRes.
 */
export function hsrMaterialIconUrl(id?: number): string | null {
  if (!id) return null;
  return `${HSR_STARRAILRES}/icon/item/${id}.png`;
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

// ── HSR Elements & Paths ─────────────────────────────────────────────────────

const HSR_STARRAILRES = "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master";

// Display name → internal key used in StarRailRes file paths
const HSR_ELEMENT_SLUG: Record<string, string> = {
  Physical:  "Physical",
  Fire:      "Fire",
  Ice:       "Ice",
  Lightning: "Thunder",   // display name differs from file name
  Wind:      "Wind",
  Quantum:   "Quantum",
  Imaginary: "Imaginary",
};

export function hsrElementIconUrl(element?: string): string | null {
  if (!element) return null;
  const slug = HSR_ELEMENT_SLUG[element];
  return slug ? `${HSR_STARRAILRES}/icon/element/${slug}.png` : null;
}

// Display name → filename (most match, but "The Hunt" → "Hunt")
const HSR_PATH_SLUG: Record<string, string> = {
  Destruction:  "Destruction",
  "The Hunt":   "Hunt",
  Erudition:    "Erudition",
  Harmony:      "Harmony",
  Nihility:     "Nihility",
  Preservation: "Preservation",
  Abundance:    "Abundance",
  Remembrance:  "Remembrance",
};

export function hsrPathIconUrl(path?: string): string | null {
  if (!path) return null;
  const slug = HSR_PATH_SLUG[path];
  return slug ? `${HSR_STARRAILRES}/icon/path/${slug}.png` : null;
}

// ── HSR Stats ────────────────────────────────────────────────────────────────

// Raw property type → { in-game display name, StarRailRes icon path }
// Source: index_new/en/properties.json
const HSR_STAT_DISPLAY: Record<string, { name: string; icon: string | null }> = {
  MaxHP:                       { name: "HP",                       icon: "icon/property/IconMaxHP.png" },
  Attack:                      { name: "ATK",                      icon: "icon/property/IconAttack.png" },
  Defence:                     { name: "DEF",                      icon: "icon/property/IconDefence.png" },
  Speed:                       { name: "SPD",                      icon: "icon/property/IconSpeed.png" },
  CriticalChance:              { name: "CRIT Rate",                icon: "icon/property/IconCriticalChance.png" },
  CriticalChanceBase:          { name: "CRIT Rate",                icon: "icon/property/IconCriticalChance.png" },
  CriticalDamage:              { name: "CRIT DMG",                 icon: "icon/property/IconCriticalDamage.png" },
  CriticalDamageBase:          { name: "CRIT DMG",                 icon: "icon/property/IconCriticalDamage.png" },
  BreakDamageAddedRatio:       { name: "Break Effect",             icon: "icon/property/IconBreakUp.png" },
  BreakDamageAddedRatioBase:   { name: "Break Effect",             icon: "icon/property/IconBreakUp.png" },
  HealRatio:                   { name: "Outgoing Healing Boost",   icon: "icon/property/IconHealRatio.png" },
  HealRatioBase:               { name: "Outgoing Healing Boost",   icon: "icon/property/IconHealRatio.png" },
  HealTakenRatio:              { name: "Incoming Healing Boost",   icon: "icon/property/IconHealRatio.png" },
  MaxSP:                       { name: "Max Energy",               icon: "icon/property/IconEnergyLimit.png" },
  SPRatio:                     { name: "Energy Regen Rate",        icon: "icon/property/IconEnergyRecovery.png" },
  SPRatioBase:                 { name: "Energy Regen Rate",        icon: "icon/property/IconEnergyRecovery.png" },
  StatusProbability:           { name: "Effect Hit Rate",          icon: "icon/property/IconStatusProbability.png" },
  StatusProbabilityBase:       { name: "Effect Hit Rate",          icon: "icon/property/IconStatusProbability.png" },
  StatusResistance:            { name: "Effect RES",               icon: "icon/property/IconStatusResistance.png" },
  StatusResistanceBase:        { name: "Effect RES",               icon: "icon/property/IconStatusResistance.png" },
  PhysicalAddedRatio:          { name: "Physical DMG Boost",       icon: "icon/property/IconPhysicalAddedRatio.png" },
  PhysicalResistance:          { name: "Physical RES Boost",       icon: "icon/property/IconPhysicalResistanceDelta.png" },
  PhysicalResistanceDelta:     { name: "Physical RES Boost",       icon: "icon/property/IconPhysicalResistanceDelta.png" },
  FireAddedRatio:              { name: "Fire DMG Boost",           icon: "icon/property/IconFireAddedRatio.png" },
  FireResistance:              { name: "Fire RES Boost",           icon: "icon/property/IconFireResistanceDelta.png" },
  FireResistanceDelta:         { name: "Fire RES Boost",           icon: "icon/property/IconFireResistanceDelta.png" },
  IceAddedRatio:               { name: "Ice DMG Boost",            icon: "icon/property/IconIceAddedRatio.png" },
  IceResistance:               { name: "Ice RES Boost",            icon: "icon/property/IconIceResistanceDelta.png" },
  IceResistanceDelta:          { name: "Ice RES Boost",            icon: "icon/property/IconIceResistanceDelta.png" },
  ThunderAddedRatio:           { name: "Lightning DMG Boost",      icon: "icon/property/IconThunderAddedRatio.png" },
  ThunderResistance:           { name: "Lightning RES Boost",      icon: "icon/property/IconThunderResistanceDelta.png" },
  ThunderResistanceDelta:      { name: "Lightning RES Boost",      icon: "icon/property/IconThunderResistanceDelta.png" },
  WindAddedRatio:              { name: "Wind DMG Boost",           icon: "icon/property/IconWindAddedRatio.png" },
  WindResistance:              { name: "Wind RES Boost",           icon: "icon/property/IconWindResistanceDelta.png" },
  WindResistanceDelta:         { name: "Wind RES Boost",           icon: "icon/property/IconWindResistanceDelta.png" },
  QuantumAddedRatio:           { name: "Quantum DMG Boost",        icon: "icon/property/IconQuantumAddedRatio.png" },
  QuantumResistance:           { name: "Quantum RES Boost",        icon: "icon/property/IconQuantumResistanceDelta.png" },
  QuantumResistanceDelta:      { name: "Quantum RES Boost",        icon: "icon/property/IconQuantumResistanceDelta.png" },
  ImaginaryAddedRatio:         { name: "Imaginary DMG Boost",      icon: "icon/property/IconImaginaryAddedRatio.png" },
  ImaginaryResistance:         { name: "Imaginary RES Boost",      icon: "icon/property/IconImaginaryResistanceDelta.png" },
  ImaginaryResistanceDelta:    { name: "Imaginary RES Boost",      icon: "icon/property/IconImaginaryResistanceDelta.png" },
  BaseHP:                      { name: "HP",                       icon: "icon/property/IconMaxHP.png" },
  HPDelta:                     { name: "HP",                       icon: "icon/property/IconMaxHP.png" },
  HPAddedRatio:                { name: "HP",                       icon: "icon/property/IconMaxHP.png" },
  BaseAttack:                  { name: "ATK",                      icon: "icon/property/IconAttack.png" },
  AttackDelta:                 { name: "ATK",                      icon: "icon/property/IconAttack.png" },
  AttackAddedRatio:            { name: "ATK",                      icon: "icon/property/IconAttack.png" },
  BaseDefence:                 { name: "DEF",                      icon: "icon/property/IconDefence.png" },
  DefenceDelta:                { name: "DEF",                      icon: "icon/property/IconDefence.png" },
  DefenceAddedRatio:           { name: "DEF",                      icon: "icon/property/IconDefence.png" },
  BaseSpeed:                   { name: "SPD",                      icon: "icon/property/IconSpeed.png" },
  SpeedDelta:                  { name: "SPD",                      icon: "icon/property/IconSpeed.png" },
  SpeedAddedRatio:             { name: "SPD",                      icon: "icon/property/IconSpeed.png" },
  AllDamageTypeAddedRatio:     { name: "DMG Boost",                icon: "icon/property/IconAttack.png" },
  ElationDamageAddedRatio:     { name: "Elation DMG Boost",        icon: "icon/property/IconJoy.png" },
  ElationDamageAddedRatioBase: { name: "Elation DMG Boost",        icon: "icon/property/IconJoy.png" },
};

export function hsrStatName(type: string): string {
  return HSR_STAT_DISPLAY[type]?.name ?? type;
}

export function hsrStatIconUrl(type: string): string | null {
  const icon = HSR_STAT_DISPLAY[type]?.icon;
  return icon ? `${HSR_STARRAILRES}/${icon}` : null;
}

// ── HSR Light Cones ──────────────────────────────────────────────────────────

export function lightConeIconUrl(images?: Record<string, string>): string | null {
  return images?.icon ?? null;
}

export function lightConeSplashUrl(images?: Record<string, string>): string | null {
  return images?.portrait ?? images?.preview ?? images?.icon ?? null;
}

// ── HSR Relics ────────────────────────────────────────────────────────────────

export function relicIconUrl(images?: Record<string, string>): string | null {
  return images?.icon ?? null;
}
