import type { LevelExp } from "./materials";
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
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
  game: Game;
  sourceId?: number;
  name: string;
  title?: string;
  description?: string;
  rarity: number;
  /** Officially announced, not released yet (picture, element and class only) */
  upcoming?: boolean;
  /** Only on limited banners */
  limited?: boolean;
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
  /** ZZZ */
  specialty?: string;
  attackType?: string;
  subElement?: string;
  height?: string;
  profile?: Array<{ name: string; value: string }>;
  gallery?: Array<{ label: string; src: string }>;
  animated?: Array<{ label: string; url: string }>;
  extraStats?: Array<{ name: string; value: string }>;
  /** Outfits (art switcher under the splash) */
  /** fit "contain": art that is not a character portrait (HSR weapon-only outfit) */
  skins?: Array<{ name?: string; desc?: string; splash?: string; icon?: string; default?: boolean; fit?: "contain" }>;
  /** The game's recommended build (ZZZ) */
  build?: {
    fourPiece?: string;
    twoPiece?: string[];
    mainStats?: Record<string, string>;
    substats?: string[];
    alternatives?: Array<{ sets: string[]; substats: string[] }>;
    /** HSR / WuWa: set groups in priority order ("4-Piece", "Planar Ornament"…) */
    sets?: Array<{ label: string; names: string[] }>;
    /** HSR / WuWa: main stats per slot ("Body", "4-Cost"…) */
    slots?: Array<{ slot: string; stats: string[] }>;
  };
  signatureWeapon?: string;
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
  /** Hover glossary for kit texts */
  glossary?: Array<{ name: string; desc: string }>;
  /** WuWa: cumulative EXP per level and the EXP potions */
  levelExp?: LevelExp;
  images?: Record<string, string>;
  url?: Record<string, string>;
  availableElements?: string[];
  /** Per-element data of multi-element characters (Trailblazer paths, Rover) */
  elementVariants?: Record<
    string,
    Partial<Pick<Character, "path" | "stats" | "costs" | "images" | "sourceId">>
  >;
  /** Kit enhancement ids (Hexerei, Novaflare, …) */
  enhancements?: string[];
}

export interface Weapon {
  _id: string;
  /** Full-size artwork and animated versions (CZN partners) */
  gallery?: Array<{ label: string; src: string }>;
  animated?: Array<{ label: string; url: string }>;
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
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
  /** EXP curve and EXP items (ZZZ) */
  levelExp?: LevelExp;
  /** Agent whose signature this is (ZZZ) */
  signatureOf?: string;
  costs?: Record<string, MaterialCostEntry[]>;
  images?: Record<string, string>;
  url?: Record<string, string>;
}

export interface Artifact {
  _id: string;
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
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
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
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
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
  game: Game;
  name: string;
  isTraveler?: boolean;
  elementVariants?: Record<string, TalentVariant>;
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
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
  game: Game;
  name: string;
  isTraveler?: boolean;
  elementVariants?: Record<string, ConstellationVariant>;
}

export interface LightCone {
  _id: string;
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
  game: Game;
  sourceId?: number;
  name: string;
  description?: string;
  path?: string;
  rarity: number;
  effectName?: string;
  effectTemplateRaw?: string;
  version?: string;
  signatureOf?: string;
  superimpositions?: Array<{ description: string; values: number[] }>;
  stats?: Record<string, { hp: number; atk: number; def: number }>;
  costs?: Record<string, MaterialCostEntry[]>;
  levelExp?: LevelExp;
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
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
  game: Game;
  sourceId?: number;
  name: string;
  /** Set story (ZZZ Drive Discs) */
  description?: string;
  type?: "cavern" | "planar" | "disc" | "gear";
  /** Endfield gear sets: one bonus for N pieces, and every piece of every tier */
  setPieces?: number;
  setBonus?: string;
  items?: Array<{ name: string; slot?: string; rarity?: number; icon?: string; level?: number }>;
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
  /** One-time unlock cost */
  cost?: MaterialCostEntry[];
}

export interface Trace {
  _id: string;
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
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
  /** cost = one-time unlock cost of the node (on its first stat) */
  statBonuses?: Array<{ stat: string; value: number; unlockPhase?: number; cost?: MaterialCostEntry[] }>;
  costs?: Record<string, Record<string, MaterialCostEntry[]>>;
  images?: Record<string, string>;
  isTraveler?: boolean;
  elementVariants?: Record<string, Partial<Trace>>;
  /** Character Enhancement: the enhanced kit (the document is the original one) */
  enhanced?: Partial<Trace> | null;
}

export interface EidolonLevel {
  name: string;
  description: string;
}

export interface Eidolon {
  _id: string;
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
  game: Game;
  name: string;
  e1?: EidolonLevel;
  e2?: EidolonLevel;
  e3?: EidolonLevel;
  e4?: EidolonLevel;
  e5?: EidolonLevel;
  e6?: EidolonLevel;
  images?: Record<string, string>;
  isTraveler?: boolean;
  elementVariants?: Record<string, Partial<Eidolon>>;
  /** Character Enhancement: the eidolons whose text the enhancement changed */
  enhanced?: Partial<Record<"e1" | "e2" | "e3" | "e4" | "e5" | "e6", EidolonLevel>> | null;
}

// ── WuWa Types ────────────────────────────────────────────────────────────────

export interface ForteSkill {
  name: string;
  maxLevel?: number;
  desc?: string;
  params?: number[][];
  icon?: string;
  /** Short in-game summary (simple view) */
  resume?: string;
  /** Multipliers per level: [{ name: "Stage 1 DMG", values: ["33.43%", …] }] */
  attributes?: Array<{ name: string; values: string[] }>;
}

export interface ForteInherentSkill {
  name: string;
  desc?: string;
  icon?: string;
  unlockPhase?: number;
  /** One-time unlock cost */
  cost?: MaterialCostEntry[];
}

export interface Forte {
  _id: string;
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
  game: "wuwa";
  name: string;
  basicAtk?: ForteSkill;
  resonanceSkill?: ForteSkill;
  resonanceLiberation?: ForteSkill;
  forteCircuit?: ForteSkill;
  introSkill?: ForteSkill;
  outroSkill?: ForteSkill;
  /** In-game Skill Input guide; texts use **bold** and [[key:Name|iconUrl]] tokens */
  guide?: {
    features?: string[];
    forteGauge?: string[];
    instructions?: string[];
    modes?: Array<{ name: string; desc?: string; icon?: string }>;
  };
  inherentSkill1?: ForteInherentSkill;
  inherentSkill2?: ForteInherentSkill;
  /** cost = one-time unlock cost of the node (on its first stat) */
  statBonuses?: Array<{ stat: string; value: number; unlockPhase?: number; cost?: MaterialCostEntry[] }>;
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
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
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
  name?: string;
  desc?: string;
  levels?: string[][];
  params?: number[][];
  cooldown?: number;
}

export interface Echo {
  _id: string;
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
  game: "wuwa";
  sourceId?: string;
  name: string;
  description?: string;
  element?: string;
  echoClass?: EchoClass;
  cost?: 1 | 3 | 4;
  sonataSet?: string;
  sonataSets?: string[];
  skill?: EchoSkill;
  mainStatOptions?: string[];
  images?: Record<string, string>;
}

export interface EchoSet {
  _id: string;
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
  game: "wuwa";
  sourceId?: string;
  name: string;
  description?: string;
  onePieceBonus?: string;
  twoPieceBonus?: string;
  threePieceBonus?: string;
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

// ── Kit enhancements (shared/games/<game>/enhancements/*.yaml) ────────────────

export type EnhancementColor = "violet" | "amber" | "sky" | "emerald" | "rose" | "orange";

export interface EnhancementType {
  id: string;
  name: string;
  version?: string;
  kind: "addition" | "rework";
  color?: EnhancementColor;
  condition?: string;
  description?: string;
  verified?: boolean;
  characters?: string[];
}

export interface EnhancementText {
  name?: string;
  description?: string;
}

export interface Enhancement {
  type: string;
  character: string;
  /** e.g. "talent.combat1", "constellation.c2", "eidolon.e1", "talent.extra" */
  target: string;
  text?: string;
  original?: EnhancementText;
  enhanced?: EnhancementText;
  sources?: string[];
}

export interface EnhancementBundle {
  types: EnhancementType[];
  entries: Enhancement[];
}

// ── Synchronisation ───────────────────────────────────────────────────────────

export interface SyncGameStatus {
  game: Game;
  name: string;
  syncable: boolean;
  source: string | null;
  upstreamVersion?: string;
  gameVersion?: string;
  lastCheckAt?: string;
  lastSyncAt?: string;
  lastStatus?: "up-to-date" | "applied" | "failed" | "dry-run" | "running";
  lastError?: string;
  unseen?: boolean;
}

export interface SyncStatus {
  running: string | null;
  unseen: boolean;
  scheduler?: { enabled: boolean; intervalHours: number; nextRunAt: string | null };
  data: SyncGameStatus[];
}

export interface ChangelogItem {
  model: string;
  name: string;
  fields?: string[];
}

export interface ChangelogEntry {
  _id: string;
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
  game: Game;
  status: "applied" | "failed" | "dry-run" | "rolled-back";
  upstreamBefore?: string;
  upstreamAfter?: string;
  gameVersion?: string;
  added: ChangelogItem[];
  changed: ChangelogItem[];
  missing: ChangelogItem[];
  problems?: string[];
  warnings?: string[];
  backup?: string;
  durationMs?: number;
  createdAt: string;
}

export interface SyncReport {
  game: Game;
  status: string;
  added?: ChangelogItem[];
  changed?: ChangelogItem[];
  errors?: string[];
  notes?: string[];
}

export interface EnhancementLoadStatus {
  loadedAt: string | null;
  files: Array<{ file: string; status: "loaded" | "rejected"; id?: string; entries?: number; errors?: number }>;
  errors: string[];
}

// ── ZZZ ───────────────────────────────────────────────────────────────────────

export interface AgentSkill {
  name: string;
  entries: Array<{ name: string; desc?: string }>;
  params: Array<{ group?: string; name: string; values: string[] }>;
  maxLevel: number;
}

export interface AgentKit {
  _id: string;
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
  game: Game;
  name: string;
  skills?: Partial<Record<"basic" | "dodge" | "assist" | "special" | "chain", AgentSkill>>;
  core?: {
    name: string;
    levels: Array<{ level: number; label: string; desc?: string; unlockLevel?: number; stats?: Array<{ name: string; value: string }> }>;
    additional?: { name: string; desc: string };
  };
  mindscapes?: Array<{ index: number; name: string; desc: string; flavor?: string }>;
  costs?: Record<string, Record<string, MaterialCostEntry[]>>;
}

export interface Bangboo {
  _id: string;
  /** English name when the game texts are shown in French (lib/i18n.ts) */
  _name?: string;
  game: Game;
  sourceId?: number;
  name: string;
  rarity: number;
  description?: string;
  version?: string;
  skills?: Array<{ kind: string; name?: string; desc?: string; descs?: string[]; params: Array<{ name: string; values: string[] }>; maxLevel: number }>;
  images?: Record<string, string>;
}
