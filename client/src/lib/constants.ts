import type { Game } from "./types";

export interface GameInfo {
  id: Game;
  name: string;
  shortName: string;
  description: string;
  available: boolean;
}

export const GAMES: GameInfo[] = [
  {
    id: "genshin",
    name: "Genshin Impact",
    shortName: "Genshin",
    description: "Open-world action RPG by HoYoverse",
    available: true,
  },
  {
    id: "hsr",
    name: "Honkai: Star Rail",
    shortName: "HSR",
    description: "Space fantasy RPG by HoYoverse",
    available: false,
  },
  {
    id: "zzz",
    name: "Zenless Zone Zero",
    shortName: "ZZZ",
    description: "Urban fantasy ARPG by HoYoverse",
    available: false,
  },
  {
    id: "wuwa",
    name: "Wuthering Waves",
    shortName: "WuWa",
    description: "Open-world action RPG by Kuro Games",
    available: false,
  },
  {
    id: "endfield",
    name: "Arknights: Endfield",
    shortName: "Endfield",
    description: "Open-world RPG by Hypergryph",
    available: false,
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

export const GENSHIN_WEAPON_TYPES = [
  "Sword",
  "Claymore",
  "Polearm",
  "Catalyst",
  "Bow",
] as const;

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

export const RARITY_COLOR_MAP: Record<number, string> = {
  5: "bg-rarity-5",
  4: "bg-rarity-4",
  3: "bg-rarity-3",
  2: "bg-rarity-2",
  1: "bg-rarity-1",
};
