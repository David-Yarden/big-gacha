
import { REGISTRY_GAMES, type RegistryGame } from "./registry";

export type GameInfo = RegistryGame;

/** Games known to Big Gacha — defined once in shared/games.json */
export const GAMES: GameInfo[] = REGISTRY_GAMES;

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
  Elation:      "bg-hsr-elation",
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
  6: "bg-rarity-6",
  5: "bg-rarity-5",
  4: "bg-rarity-4",
  3: "bg-rarity-3",
  2: "bg-rarity-2",
  1: "bg-rarity-1",
};

// ── WuWa ─────────────────────────────────────────────────────────────────────

export const WUWA_ELEMENT_COLOR_MAP: Record<string, string> = {
  Glacio:  "bg-wuwa-glacio",
  Fusion:  "bg-wuwa-fusion",
  Electro: "bg-wuwa-electro",
  Aero:    "bg-wuwa-aero",
  Spectro: "bg-wuwa-spectro",
  Havoc:   "bg-wuwa-havoc",
};

export const ZZZ_ELEMENT_COLOR_MAP: Record<string, string> = {
  Physical: "bg-zzz-physical",
  Fire:     "bg-zzz-fire",
  Ice:      "bg-zzz-ice",
  Electric: "bg-zzz-electric",
  Ether:    "bg-zzz-ether",
  Wind:     "bg-zzz-wind",
  Lumiflux: "bg-zzz-lumiflux",
};

export const ENDFIELD_ELEMENT_COLOR_MAP: Record<string, string> = {
  Physical: "bg-ef-physical",
  Heat:     "bg-ef-heat",
  Cryo:     "bg-ef-cryo",
  Electric: "bg-ef-electric",
  Nature:   "bg-ef-nature",
};

// Endfield operator promotions: at 20, 40, 60 and 80 (cap 90)
export const ENDFIELD_ASCENSION_LEVELS = [1, 20, 40, 60, 80, 90] as const;

// Agent promotion levels (one promotion every 10 levels, max 60)
export const ZZZ_ASCENSION_LEVELS = [1, 10, 20, 30, 40, 50, 60] as const;

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
  outroSkill:          "Outro Skill",
};

export const WUWA_ECHO_CLASSES: Record<string, { label: string; cost: number }> = {
  Common:   { label: "Common",   cost: 1 },
  Elite:    { label: "Elite",    cost: 3 },
  Overlord: { label: "Overlord", cost: 4 },
  Calamity: { label: "Calamity", cost: 4 },
};

// Ascending level breakpoints (same as Genshin: 20/40/50/60/70/80/90)
export const WUWA_ASCENSION_LEVELS = [1, 20, 40, 50, 60, 70, 80, 90] as const;
