export type Game = "genshin" | "hsr" | "zzz" | "wuwa" | "endfield";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  count: number;
  total: number;
  page: number;
  totalPages: number;
  data: T[];
}

export interface MaterialCostEntry {
  id: number;
  name: string;
  count: number;
}

export interface Character {
  _id: string;
  game: Game;
  sourceId?: number;
  name: string;
  title?: string;
  description?: string;
  rarity: number;
  element?: string;
  elementType?: string;
  weaponType?: string;
  weaponTypeRaw?: string;
  bodyType?: string;
  gender?: string;
  region?: string;
  affiliation?: string;
  associationType?: string;
  birthday?: string;
  birthdaymmdd?: string;
  constellation?: string;
  substatType?: string;
  substatText?: string;
  version?: string;
  cv?: {
    english?: string;
    chinese?: string;
    japanese?: string;
    korean?: string;
  };
  costs?: Record<string, MaterialCostEntry[]>;
  images?: Record<string, string>;
  url?: Record<string, string>;
}

export interface Weapon {
  _id: string;
  game: Game;
  sourceId?: number;
  name: string;
  description?: string;
  weaponType?: string;
  rarity: number;
  baseAtkValue?: number;
  mainStatType?: string;
  mainStatText?: string;
  baseStatText?: string;
  effectName?: string;
  effectTemplateRaw?: string;
  version?: string;
  refinements?: Array<{ description: string; values?: string[] }>;
  costs?: Record<string, MaterialCostEntry[]>;
  images?: Record<string, string>;
  url?: Record<string, string>;
}

export interface Artifact {
  _id: string;
  game: Game;
  name: string;
  rarity?: number[];
  twoPieceBonus?: string;
  fourPieceBonus?: string;
  version?: string;
  pieces?: {
    flower?: { name: string; relicType: string; description: string };
    plume?: { name: string; relicType: string; description: string };
    sands?: { name: string; relicType: string; description: string };
    goblet?: { name: string; relicType: string; description: string };
    circlet?: { name: string; relicType: string; description: string };
  };
  images?: Record<string, string>;
  url?: Record<string, string>;
}

export interface Material {
  _id: string;
  game: Game;
  sourceId?: number;
  name: string;
  description?: string;
  category?: string;
  materialType?: string;
  rarity?: number;
  source?: string[];
  version?: string;
  images?: Record<string, string>;
}

export interface TalentCombat {
  name: string;
  description?: string;
  descriptionRaw?: string;
  attributes: {
    labels: string[];
    parameters: Record<string, number[]>;
  };
}

export interface Talent {
  _id: string;
  game: Game;
  name: string;
  combat1?: TalentCombat;
  combat2?: TalentCombat;
  combat3?: TalentCombat;
  combatsp?: TalentCombat;
  passive1?: { name: string; description: string };
  passive2?: { name: string; description: string };
  passive3?: { name: string; description: string };
  passive4?: { name: string; description: string };
  costs?: Record<string, MaterialCostEntry[]>;
  images?: Record<string, string>;
}

export interface ConstellationLevel {
  name: string;
  description: string;
}

export interface Constellation {
  _id: string;
  game: Game;
  name: string;
  c1?: ConstellationLevel;
  c2?: ConstellationLevel;
  c3?: ConstellationLevel;
  c4?: ConstellationLevel;
  c5?: ConstellationLevel;
  c6?: ConstellationLevel;
  images?: Record<string, string>;
}

export interface GameStats {
  characters: number;
  weapons: number;
  artifacts: number;
  materials: number;
  talents: number;
  constellations: number;
}
