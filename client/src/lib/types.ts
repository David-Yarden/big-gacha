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
  icon?: string;
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
  path?: string;
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
  stats?: Record<string, { hp: number; atk: number; def: number; specialized: number }>;
  images?: Record<string, string>;
  url?: Record<string, string>;
  availableElements?: string[];
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
  stats?: Record<string, { atk: number; specialized: number }>;
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

export interface TalentVariant {
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

export interface Talent extends TalentVariant {
  _id: string;
  game: Game;
  name: string;
  isTraveler?: boolean;
  elementVariants?: Record<string, TalentVariant>;
  hexerei?: Record<string, string>;
}

export interface ConstellationLevel {
  name: string;
  description: string;
}

export interface ConstellationVariant {
  c1?: ConstellationLevel;
  c2?: ConstellationLevel;
  c3?: ConstellationLevel;
  c4?: ConstellationLevel;
  c5?: ConstellationLevel;
  c6?: ConstellationLevel;
  images?: Record<string, string>;
}

export interface Constellation extends ConstellationVariant {
  _id: string;
  game: Game;
  name: string;
  isTraveler?: boolean;
  elementVariants?: Record<string, ConstellationVariant>;
  hexerei?: Record<string, string>;
}

export interface LightCone {
  _id: string;
  game: Game;
  sourceId?: number;
  name: string;
  description?: string;
  path?: string;
  rarity: number;
  effectName?: string;
  effectTemplateRaw?: string;
  version?: string;
  superimpositions?: Array<{ description: string; values: number[] }>;
  stats?: Record<string, { hp: number; atk: number; def: number }>;
  costs?: Record<string, MaterialCostEntry[]>;
  images?: Record<string, string>;
}

export interface RelicPiece {
  name: string;
  relicType?: string;
  description?: string;
  icon?: string;
}

export interface Relic {
  _id: string;
  game: Game;
  sourceId?: number;
  name: string;
  type?: "cavern" | "planar";
  rarity?: number[];
  twoPieceBonus?: string;
  fourPieceBonus?: string;
  version?: string;
  pieces?: {
    head?: RelicPiece;
    hands?: RelicPiece;
    body?: RelicPiece;
    feet?: RelicPiece;
    sphere?: RelicPiece;
    rope?: RelicPiece;
  };
  images?: Record<string, string>;
}

export interface TraceSkill {
  name: string;
  maxLevel?: number;
  desc?: string;
  params?: number[][];
  icon?: string;
}

export interface MemospriteGroup {
  skills: TraceSkill[];
  costs?: Record<string, MaterialCostEntry[]>;
}

export interface MajorTrace {
  name: string;
  desc?: string;
  params?: number[][];
  icon?: string;
  unlockPhase?: number;
}

export interface TraceNovaflare {
  basicAtk?: TraceSkill;
  skill?: TraceSkill;
  ultimate?: TraceSkill;
  talent?: TraceSkill;
  technique?: TraceSkill;
}

export interface Trace {
  _id: string;
  game: Game;
  name: string;
  basicAtk?: TraceSkill;
  skill?: TraceSkill;
  ultimate?: TraceSkill;
  talent?: TraceSkill;
  technique?: TraceSkill;
  elation?: TraceSkill;
  memospriteGroups?: MemospriteGroup[];
  majorTraces?: MajorTrace[];
  statBonuses?: Array<{ stat: string; value: number; unlockPhase?: number }>;
  costs?: Record<string, Record<string, MaterialCostEntry[]>>;
  images?: Record<string, string>;
  novaflare?: TraceNovaflare;
  isTraveler?: boolean;
  elementVariants?: Record<string, Partial<Trace>>;
}

export interface EidolonLevel {
  name: string;
  description: string;
}

export interface Eidolon {
  _id: string;
  game: Game;
  name: string;
  e1?: EidolonLevel;
  e2?: EidolonLevel;
  e3?: EidolonLevel;
  e4?: EidolonLevel;
  e5?: EidolonLevel;
  e6?: EidolonLevel;
  images?: Record<string, string>;
  novaflare?: Partial<Record<"e1" | "e2" | "e3" | "e4" | "e5" | "e6", EidolonLevel>>;
  isTraveler?: boolean;
  elementVariants?: Record<string, Partial<Eidolon>>;
}

// ── WuWa Types ────────────────────────────────────────────────────────────────

export interface ForteSkill {
  name: string;
  maxLevel?: number;
  desc?: string;
  params?: number[][];
  icon?: string;
}

export interface ForteInherentSkill {
  name: string;
  desc?: string;
  icon?: string;
  unlockPhase?: number;
}

export interface Forte {
  _id: string;
  game: "wuwa";
  name: string;
  basicAtk?: ForteSkill;
  resonanceSkill?: ForteSkill;
  resonanceLiberation?: ForteSkill;
  forteCircuit?: ForteSkill;
  introSkill?: ForteSkill;
  inherentSkill1?: ForteInherentSkill;
  inherentSkill2?: ForteInherentSkill;
  statBonuses?: Array<{ stat: string; value: number; unlockPhase?: number }>;
  costs?: Record<string, Record<string, MaterialCostEntry[]>>;
  images?: Record<string, string>;
  isTraveler?: boolean;
  elementVariants?: Record<string, Partial<Forte>>;
}

export interface ResonanceChainSequence {
  name: string;
  description: string;
}

export interface ResonanceChain {
  _id: string;
  game: "wuwa";
  name: string;
  s1?: ResonanceChainSequence;
  s2?: ResonanceChainSequence;
  s3?: ResonanceChainSequence;
  s4?: ResonanceChainSequence;
  s5?: ResonanceChainSequence;
  s6?: ResonanceChainSequence;
  images?: Record<string, string>;
  isTraveler?: boolean;
  elementVariants?: Record<string, Partial<ResonanceChain>>;
}

export type EchoClass = "Common" | "Elite" | "Overlord" | "Calamity";

export interface EchoSkill {
  name: string;
  desc?: string;
  params?: number[][];
  cooldown?: number;
}

export interface Echo {
  _id: string;
  game: "wuwa";
  sourceId?: string;
  name: string;
  description?: string;
  element?: string;
  echoClass?: EchoClass;
  cost?: 1 | 3 | 4;
  sonataSet?: string;
  skill?: EchoSkill;
  mainStatOptions?: string[];
  images?: Record<string, string>;
}

export interface EchoSet {
  _id: string;
  game: "wuwa";
  sourceId?: string;
  name: string;
  description?: string;
  twoPieceBonus?: string;
  fivePieceBonus?: string;
  element?: string;
  images?: Record<string, string>;
}

// ── Shared ────────────────────────────────────────────────────────────────────

export interface GameStats {
  characters: number;
  weapons: number;
  artifacts: number;
  materials: number;
  talents: number;
  constellations: number;
  lightcones?: number;
  relics?: number;
  traces?: number;
  eidolons?: number;
  fortes?: number;
  resonanceChains?: number;
  echoes?: number;
  echoSets?: number;
}
