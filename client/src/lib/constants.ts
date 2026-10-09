import type { Game } from "./types";

export interface GameInfo {
  id: Game;
  name: string;
  shortName: string;
  description: string;
  available: boolean;
  /** Title artwork in /public */
  logo: string;
  /** Extra classes for the logo (e.g. invert a dark logo on the dark theme) */
  logoClassName?: string;
}

export const GAMES: GameInfo[] = [
  {
    id: "genshin",
    name: "Genshin Impact",
    shortName: "Genshin",
    description: "Open-world action RPG by HoYoverse",
    available: true,
    logo: "/Genshin_title.svg",
    logoClassName: "invert",
  },
  {
    id: "hsr",
    name: "Honkai: Star Rail",
    shortName: "HSR",
    description: "Space fantasy RPG by HoYoverse",
    available: true,
    logo: "/HSR_title.png",
  },
  {
    id: "zzz",
    name: "Zenless Zone Zero",
    shortName: "ZZZ",
    description: "Urban fantasy ARPG by HoYoverse",
    available: false,
    logo: "/ZZZ_title.png",
  },
  {
    id: "wuwa",
    name: "Wuthering Waves",
    shortName: "WuWa",
    description: "Open-world action RPG by Kuro Games",
    available: true,
    logo: "/WuWa_title.png",
  },
  {
    id: "endfield",
    name: "Arknights: Endfield",
    shortName: "Endfield",
    description: "Open-world RPG by Hypergryph",
    available: false,
    logo: "/Endfield_title.png",
  },
];

export const GENSHIN_ELEMENTS = [
  "Pyro",
  "Hydro",
  "Anemo",
  "Electro",
  "Dendro",
  "Cryo",
  "Geo",
] as const;

export const GENSHIN_REGIONS = [
  "Mondstadt",
  "Liyue",
  "Inazuma",
  "Sumeru",
  "Fontaine",
  "Natlan",
  "Snezhnaya",
  "Nod-Krai",
  "Others",
] as const;

export const GENSHIN_WEAPON_TYPES = [
  "Sword",
  "Claymore",
  "Polearm",
  "Catalyst",
  "Bow",
] as const;

export const HSR_ELEMENTS = [
  "Physical",
  "Fire",
  "Ice",
  "Lightning",
  "Wind",
  "Quantum",
  "Imaginary",
] as const;

export const HSR_PATHS = [
  "Destruction",
  "The Hunt",
  "Erudition",
  "Harmony",
  "Nihility",
  "Preservation",
  "Abundance",
  "Remembrance",
] as const;

export const HSR_ELEMENT_COLOR_MAP: Record<string, string> = {
  Physical:  "bg-hsr-physical",
  Fire:      "bg-hsr-fire",
  Ice:       "bg-hsr-ice",
  Lightning: "bg-hsr-lightning",
  Wind:      "bg-hsr-wind",
  Quantum:   "bg-hsr-quantum",
  Imaginary: "bg-hsr-imaginary",
};

export const HSR_PATH_COLOR_MAP: Record<string, string> = {
  Destruction:  "bg-hsr-destruction",
  "The Hunt":   "bg-hsr-hunt",
  Erudition:    "bg-hsr-erudition",
  Harmony:      "bg-hsr-harmony",
  Nihility:     "bg-hsr-nihility",
  Preservation: "bg-hsr-preservation",
  Abundance:    "bg-hsr-abundance",
  Remembrance:  "bg-hsr-remembrance",
};

export const HSR_LC_RARITIES = [5, 4, 3] as const;

export const RARITIES = [5, 4, 3, 2, 1] as const;
export const CHARACTER_RARITIES = [5, 4] as const;
export const WEAPON_RARITIES = [5, 4, 3, 2, 1] as const;
export const ARTIFACT_RARITIES = [5, 4, 3, 2, 1] as const;

export const ELEMENT_COLOR_MAP: Record<string, string> = {
  Pyro: "bg-pyro",
  Hydro: "bg-hydro",
  Anemo: "bg-anemo",
  Electro: "bg-electro",
  Dendro: "bg-dendro",
  Cryo: "bg-cryo",
  Geo: "bg-geo",
};

// Characters whose region is missing/wrong in genshin-db — keyed by exact name
// (mirrors CHARACTER_REGION_OVERRIDES in seedGenshin.js — keep in sync)
const CHARACTER_REGION_OVERRIDES: Record<string, string> = {
  Zibai: "Liyue",
};

// Region value corrections (wrong string → correct string)
const REGION_CORRECTIONS: Record<string, string> = {};

export function resolveRegion(region?: string | null, name?: string): string {
  if (name && CHARACTER_REGION_OVERRIDES[name]) return CHARACTER_REGION_OVERRIDES[name];
  if (!region) return "Others";
  return REGION_CORRECTIONS[region] ?? region;
}

export const RARITY_COLOR_MAP: Record<number, string> = {
  5: "bg-rarity-5",
  4: "bg-rarity-4",
  3: "bg-rarity-3",
  2: "bg-rarity-2",
  1: "bg-rarity-1",
};

// ── WuWa ─────────────────────────────────────────────────────────────────────

export const WUWA_ELEMENTS = [
  "Glacio",
  "Fusion",
  "Electro",
  "Aero",
  "Spectro",
  "Havoc",
] as const;

export const WUWA_WEAPON_TYPES = [
  "Sword",
  "Broadblade",
  "Pistols",
  "Gauntlets",
  "Rectifier",
] as const;

export const WUWA_REGIONS = [
  "Jinzhou",
  "Huanglong",
  "Mt. Firmament",
  "Ragunna",
  "Others",
] as const;

export const WUWA_ELEMENT_COLOR_MAP: Record<string, string> = {
  Glacio:  "bg-wuwa-glacio",
  Fusion:  "bg-wuwa-fusion",
  Electro: "bg-wuwa-electro",
  Aero:    "bg-wuwa-aero",
  Spectro: "bg-wuwa-spectro",
  Havoc:   "bg-wuwa-havoc",
};

// All five Forte skill keys (order matches in-game Forte tree display)
export const WUWA_FORTE_SKILLS = [
  "basicAtk",
  "resonanceSkill",
  "resonanceLiberation",
  "forteCircuit",
  "introSkill",
] as const;

export const WUWA_FORTE_SKILL_LABELS: Record<string, string> = {
  basicAtk:            "Basic Attack",
  resonanceSkill:      "Resonance Skill",
  resonanceLiberation: "Resonance Liberation",
  forteCircuit:        "Forte Circuit",
  introSkill:          "Intro Skill",
};

export const WUWA_ECHO_CLASSES: Record<string, { label: string; cost: number }> = {
  Common:   { label: "Common",   cost: 1 },
  Elite:    { label: "Elite",    cost: 3 },
  Overlord: { label: "Overlord", cost: 4 },
  Calamity: { label: "Calamity", cost: 4 },
};

// Ascending level breakpoints (same as Genshin: 20/40/50/60/70/80/90)
export const WUWA_ASCENSION_LEVELS = [1, 20, 40, 50, 60, 70, 80, 90] as const;
