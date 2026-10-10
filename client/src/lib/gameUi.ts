/**
 * Per-game display rules used by the character page and the cost tables.
 * Adding a game = adding one entry here (plus its kit in components/character/kits).
 */
import {
  characterIconUrl,
  characterSplashUrl,
  elementIconUrl,
  weaponTypeIconUrl,
  materialIconUrlById,
  materialFallbackIconUrlById,
  hsrMaterialIconUrl,
  hsrElementIconUrl,
  hsrPathIconUrl,
  wuwaCharacterIconUrl,
  wuwaCharacterSplashUrl,
  wuwaElementIconUrl,
  wuwaWeaponTypeIconUrl,
} from "@/lib/images";
import {
  ASCENSION_LEVELS,
  levelToAscensionPhase,
  calculateExpMaterials,
  calculateBreakthroughMaterials,
  expPotions,
  coinsBetween,
} from "@/lib/materials";
import type { Character } from "@/lib/types";
import type { MaterialCostEntry } from "@/lib/materials";
import {
  ELEMENT_COLOR_MAP,
  HSR_ELEMENT_COLOR_MAP,
  WUWA_ELEMENT_COLOR_MAP,
  WUWA_ASCENSION_LEVELS,
  ZZZ_ELEMENT_COLOR_MAP,
  ZZZ_ASCENSION_LEVELS,
  ENDFIELD_ELEMENT_COLOR_MAP,
  ENDFIELD_ASCENSION_LEVELS,
} from "@/lib/constants";

type Images = Record<string, string> | undefined;

export interface GameUi {
  /** Highest regular level (before breakthrough) */
  maxLevel: number;
  /** Extra levels beyond maxLevel (Genshin 95/100) */
  breakthroughLevels: readonly number[];
  ascensionLevels: readonly number[];
  levelToPhase: (level: number) => number;
  levelLabel: string;
  /** "Element:" or "Path:" in the multi-element selector */
  variantLabel: string;
  elementColor: Record<string, string>;
  elementIcon: (element?: string) => string | null;
  weaponTypeIcon?: (weaponType?: string) => string | null;
  /** Show a "Region" row in the header */
  showRegion: boolean;
  /** Show a "Path" row instead of the weapon type (HSR) */
  showPath: boolean;
  splash: (images: Images) => string | null;
  /** Portrait on list cards: "cover" crops a tall icon to the square (top kept) */
  portraitFit?: "contain" | "cover";
  /** Square portrait used on list cards */
  portrait: (images: Images) => string | null;
  /** Icon for an HSR-style path (only games with showPath) */
  pathIcon?: (path?: string) => string | null;
  /** Character EXP / special costs on top of the ascension costs */
  /** EXP items (and their currency) from `from` (default 1) to `level` */
  levelMaterials: (level: number, character?: Character, from?: number) => MaterialCostEntry[];
  materialIcon: (mat: MaterialCostEntry) => { src: string | null; fallback?: string | null };
  /** ZZZ attack type icon (Slash, Strike, Pierce) */
  attackTypeIcon?: (type?: string) => string | null;
  /** Role icon (ZZZ specialty: Attack, Stun…) */
  specialtyIcon?: (specialty?: string) => string | null;
  /** Weapon level range and promotion levels (default: 90, Genshin's) */
  weaponMaxLevel?: number;
  weaponAscensionLevels?: readonly number[];
  weaponLevelToPhase?: (level: number) => number;
}

/** ZZZ: one promotion every 10 levels (level 10 is still phase 0 until promoted). */
function zzzLevelToPhase(level: number): number {
  return level <= 10 ? 0 : Math.min(5, Math.ceil(level / 10) - 1);
}

const NANOKA = "https://static.nanoka.cc/assets/zzz";
const ZZZ_ELEMENT_ICONS: Record<string, string> = {
  Physical: `${NANOKA}/IconPhysDmg.webp`,
  Fire: `${NANOKA}/IconFire.webp`,
  Ice: `${NANOKA}/IconIce.webp`,
  Electric: `${NANOKA}/IconThunder.webp`,
  Ether: `${NANOKA}/IconDungeonBuffEther.webp`,
  Wind: `${NANOKA}/IconWind.webp`,
  Frost: `${NANOKA}/IconFrost.webp`,
  "Auric Ink": `${NANOKA}/IconAuricInk.webp`,
  "Honed Edge": `${NANOKA}/IconHonedEdge.webp`,
  Lumiflux: "https://raw.githubusercontent.com/Gaiiiaaa-GH/ZZZdle-Assets/master/type_icons/elements/lumiflux.webp",
};
const ZZZ_ATTACK_ICONS: Record<string, string> = {
  Slash: `${NANOKA}/IconSlash.webp`,
  Strike: `${NANOKA}/IconStrike.webp`,
  Pierce: `${NANOKA}/IconPierce.webp`,
};

export function zzzAttackTypeIcon(type?: string): string | null {
  return (type && ZZZ_ATTACK_ICONS[type]) || null;
}

export function zzzSpecialtyIcon(specialty?: string): string | null {
  return specialty ? `https://enka.network/ui/zzz/Icon${specialty}.png` : null;
}

const HSR_ASCENSION_LEVELS = [1, 20, 30, 40, 50, 60, 70, 80] as const;

function hsrLevelToAscensionPhase(level: number): number {
  if (level <= 20) return 0;
  return Math.min(6, Math.ceil((level - 20) / 10));
}

const genshin: GameUi = {
  maxLevel: 90,
  breakthroughLevels: [95, 100],
  ascensionLevels: ASCENSION_LEVELS,
  levelToPhase: levelToAscensionPhase,
  levelLabel: "Character Level",
  variantLabel: "Element:",
  elementColor: ELEMENT_COLOR_MAP,
  elementIcon: elementIconUrl,
  weaponTypeIcon: weaponTypeIconUrl,
  showRegion: true,
  showPath: false,
  splash: (images) => characterSplashUrl(images) ?? characterIconUrl(images),
  portrait: characterIconUrl,
  levelMaterials: (level, _c, from = 1) => [...calculateExpMaterials(level, from), ...calculateBreakthroughMaterials(level, from)],
  materialIcon: (mat) => ({
    src: mat.icon ?? materialIconUrlById(mat.id),
    fallback: materialFallbackIconUrlById(mat.id),
  }),
};

const hsr: GameUi = {
  maxLevel: 80,
  breakthroughLevels: [],
  ascensionLevels: HSR_ASCENSION_LEVELS,
  levelToPhase: hsrLevelToAscensionPhase,
  levelLabel: "Character Level",
  variantLabel: "Path:",
  elementColor: HSR_ELEMENT_COLOR_MAP,
  elementIcon: hsrElementIconUrl,
  showRegion: false,
  showPath: true,
  splash: (images) => characterSplashUrl(images) ?? characterIconUrl(images),
  portrait: characterIconUrl,
  pathIcon: hsrPathIconUrl,
  // Character EXP materials (free to use in HSR: no Credit cost)
  levelMaterials: (level, character, from) => expPotions(level, character, from),
  materialIcon: (mat) => ({ src: mat.icon ?? hsrMaterialIconUrl(mat.id) }),
};

const wuwa: GameUi = {
  maxLevel: 90,
  breakthroughLevels: [],
  ascensionLevels: WUWA_ASCENSION_LEVELS,
  levelToPhase: levelToAscensionPhase,
  levelLabel: "Resonator Level",
  variantLabel: "Element:",
  elementColor: WUWA_ELEMENT_COLOR_MAP,
  elementIcon: wuwaElementIconUrl,
  weaponTypeIcon: wuwaWeaponTypeIconUrl,
  showRegion: true,
  showPath: false,
  splash: (images) => wuwaCharacterSplashUrl(images) ?? wuwaCharacterIconUrl(images),
  portrait: wuwaCharacterIconUrl,
  // EXP potions from the character's own EXP curve (never Genshin books)
  levelMaterials: (level, character, from) => expPotions(level, character, from),
  materialIcon: (mat) => ({ src: mat.icon ?? null }),
};

const zzz: GameUi = {
  maxLevel: 60,
  breakthroughLevels: [],
  ascensionLevels: ZZZ_ASCENSION_LEVELS,
  levelToPhase: zzzLevelToPhase,
  levelLabel: "Agent Level",
  variantLabel: "Attribute:",
  elementColor: ZZZ_ELEMENT_COLOR_MAP,
  elementIcon: (el) => (el && ZZZ_ELEMENT_ICONS[el]) || null,
  weaponTypeIcon: zzzSpecialtyIcon,
  attackTypeIcon: zzzAttackTypeIcon,
  specialtyIcon: zzzSpecialtyIcon,
  showRegion: false,
  showPath: false,
  splash: (images) => images?.splash ?? images?.icon ?? null,
  portrait: (images) => images?.icon ?? null,
  // Investigator Logs from the agent EXP curve
  levelMaterials: (level, character, from) => expPotions(level, character, from),
  materialIcon: (mat) => ({ src: mat.icon ?? null }),
  weaponMaxLevel: 60,
  weaponAscensionLevels: ZZZ_ASCENSION_LEVELS,
  weaponLevelToPhase: zzzLevelToPhase,
};

// ── Arknights: Endfield ─────────────────────────────────────────────────────
// UI sprites of the game (555me/EndfieldAssets, CN Android client)
const EF_UI = "https://raw.githubusercontent.com/555me/EndfieldAssets/main/assets/beyond/dynamicassets/gameplay/ui";
const EF_ELEMENT_ICONS: Record<string, string> = {
  Physical: `${EF_UI}/sprites/elementicon/icon_charattrtype_physical.png`,
  Heat: `${EF_UI}/sprites/elementicon/icon_charattrtype_fire.png`,
  Cryo: `${EF_UI}/sprites/elementicon/icon_charattrtype_cold.png`,
  Electric: `${EF_UI}/sprites/elementicon/icon_charattrtype_pulse.png`,
  Nature: `${EF_UI}/sprites/elementicon/icon_charattrtype_nature.png`,
};
const EF_WEAPON_ICONS: Record<string, string> = {
  Sword: `${EF_UI}/prefabs/weaponinfo/widget/icon_weapontype_01.png`,
  "Arts Unit": `${EF_UI}/sprites/weaponexhibit/icon_weapontype_02.png`,
  Greatsword: `${EF_UI}/sprites/weaponexhibit/icon_weapontype_03.png`,
  Polearm: `${EF_UI}/sprites/weaponexhibit/icon_weapontype_05.png`,
  Handcannon: `${EF_UI}/sprites/weaponexhibit/icon_weapontype_06.png`,
};
const EF_CLASS_ICONS: Record<string, string> = {
  Guard: "icon_profession_0",
  Defender: "icon_profession_2",
  Supporter: "icon_profession_4",
  Caster: "icon_profession_5",
  Vanguard: "icon_profession_7",
  Striker: "icon_profession_8",
};

/** Promotions at 20, 40, 60 and 80 (level 20 is still phase 0 until promoted). */
function endfieldLevelToPhase(level: number): number {
  if (level <= 20) return 0;
  if (level <= 40) return 1;
  if (level <= 60) return 2;
  if (level <= 80) return 3;
  return 4;
}

type EfCard = { id: number | string; name: string; exp: number; icon?: string };
/** Greedy EXP cards for an amount of EXP (biggest first, the smallest rounds up) */
function cardsFor(amount: number, items: EfCard[]): MaterialCostEntry[] {
  let remaining = amount;
  const out: MaterialCostEntry[] = [];
  const sorted = [...items].sort((a, b) => b.exp - a.exp);
  sorted.forEach((it, i) => {
    if (remaining <= 0) return;
    const n = i === sorted.length - 1 ? Math.ceil(remaining / it.exp) : Math.floor(remaining / it.exp);
    if (n > 0) {
      out.push({ id: it.id as number, name: it.name, count: n, icon: it.icon }); // Endfield ids are strings
      remaining -= n * it.exp;
    }
  });
  return out;
}

/** Endfield EXP: stage 1 cards up to level 60, stage 2 cards after */
function endfieldExp(level: number, character?: Character, from = 1): MaterialCostEntry[] {
  const curve = (character as unknown as {
    levelExp?: { exp: number[]; items: EfCard[]; items2?: EfCard[]; split?: number; coin?: EfCard; coinByLevel?: number[] };
  })?.levelExp;
  if (!curve?.exp?.length || level <= from) return [];
  const split = curve.split ?? 60;
  const at = (lv: number) => curve.exp[Math.min(lv, curve.exp.length - 1)] ?? 0;
  const first = at(Math.min(level, split)) - at(Math.min(from, split));
  const second = level > split ? at(level) - at(Math.max(from, split)) : 0;
  const out = [...cardsFor(first, curve.items ?? []), ...cardsFor(second, curve.items2 ?? curve.items ?? [])];
  // T-Creds are charged per level
  const gold = curve.coinByLevel ? coinsBetween(curve.coinByLevel, from, level) : 0;
  if (gold > 0 && curve.coin) out.push({ id: curve.coin.id as number, name: curve.coin.name, count: gold, icon: curve.coin.icon });
  return out;
}

const endfield: GameUi = {
  maxLevel: 90,
  breakthroughLevels: [],
  ascensionLevels: ENDFIELD_ASCENSION_LEVELS,
  levelToPhase: endfieldLevelToPhase,
  levelLabel: "Operator Level",
  variantLabel: "Element:",
  elementColor: ENDFIELD_ELEMENT_COLOR_MAP,
  elementIcon: (el) => (el && EF_ELEMENT_ICONS[el]) || null,
  weaponTypeIcon: (wt) => (wt && EF_WEAPON_ICONS[wt]) || null,
  specialtyIcon: (cls) => (cls && EF_CLASS_ICONS[cls] ? `${EF_UI}/sprites/charprofessionicon/${EF_CLASS_ICONS[cls]}.png` : null),
  showRegion: false,
  showPath: false,
  splash: (images) => images?.splash ?? images?.icon ?? null,
  portrait: (images) => images?.icon ?? null,
  portraitFit: "cover",
  levelMaterials: (level, character, from) => endfieldExp(level, character, from),
  materialIcon: (mat) => ({ src: mat.icon ?? null }),
  weaponMaxLevel: 90,
  weaponAscensionLevels: ENDFIELD_ASCENSION_LEVELS,
  weaponLevelToPhase: endfieldLevelToPhase,
};

/**
 * Neutral rules for a game registered but not configured yet (e.g. ZZZ while it is
 * being added): plain images, no game-specific materials — never another game's look.
 */
const generic: GameUi = {
  maxLevel: 90,
  breakthroughLevels: [],
  ascensionLevels: ASCENSION_LEVELS,
  levelToPhase: levelToAscensionPhase,
  levelLabel: "Level",
  variantLabel: "Element:",
  elementColor: {},
  elementIcon: () => null,
  showRegion: false,
  showPath: false,
  splash: (images) => images?.splash ?? images?.portrait ?? images?.icon ?? null,
  portrait: (images) => images?.icon ?? null,
  levelMaterials: () => [],
  materialIcon: (mat) => ({ src: mat.icon ?? null }),
};

const GAME_UI: Partial<Record<string, GameUi>> = { genshin, hsr, wuwa, zzz, endfield };

export function gameUi(game?: string): GameUi {
  const ui = game ? GAME_UI[game] : undefined;
  if (!ui && game && import.meta.env.DEV) console.warn(`gameUi: no display rules for "${game}" yet`);
  return ui ?? generic;
}
