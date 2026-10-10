import axios from "axios";
import { LANG, localizeData } from "./i18n";
import type {
  Game,
  ApiResponse,
  PaginatedResponse,
  Character,
  Weapon,
  Artifact,
  Material,
  Talent,
  Constellation,
  Trace,
  Eidolon,
  LightCone,
  Relic,
  Forte,
  ResonanceChain,
  Echo,
  EchoSet,
  GameStats,
  EnhancementBundle,
  SyncStatus,
  ChangelogEntry,
  SyncReport,
  EnhancementLoadStatus, AgentKit, Bangboo
} from "./types";

const client = axios.create({
  baseURL: "/api",
  // Required by the API for actions (see src/server.js)
  headers: { "X-Big-Gacha": "1" },
});

// French: ask for the translations with any field selection, and lay them over the
// English texts in every response (see lib/i18n.ts)
if (LANG === "fr") {
  client.interceptors.request.use((config) => {
    const fields = config.params?.fields;
    config.params = { ...config.params, lang: "fr" };
    if (typeof fields === "string" && fields && !/\bi18n\b/.test(fields)) config.params.fields = `${fields},i18n`;
    return config;
  });
  client.interceptors.response.use((res) => {
    res.data = localizeData(res.data);
    return res;
  });
}

export interface QueryParams {
  search?: string;
  sort?: string;
  fields?: string;
  page?: number;
  limit?: number;
  [key: string]: string | number | undefined;
}

function buildParams(params?: QueryParams): Record<string, string> {
  if (!params) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      out[key] = String(value);
    }
  }
  return out;
}

// ── Generic resource access (every list/detail call goes through these two) ──

async function getList<T>(game: Game, resource: string, params?: QueryParams): Promise<PaginatedResponse<T>> {
  const { data } = await client.get(`/${game}/${resource}`, { params: buildParams(params) });
  return data;
}

async function getOne<T>(game: Game, resource: string, name: string): Promise<ApiResponse<T>> {
  const { data } = await client.get(`/${game}/${resource}/${encodeURIComponent(name)}`);
  return data;
}

type List<T> = (game: Game, params?: QueryParams) => Promise<PaginatedResponse<T>>;
type One<T> = (game: Game, name: string) => Promise<ApiResponse<T>>;
const list = <T>(resource: string): List<T> => (game, params) => getList<T>(game, resource, params);
const one = <T>(resource: string): One<T> => (game, name) => getOne<T>(game, resource, name);

export const getCharacters = list<Character>("characters");
export const getCharacter = one<Character>("characters");
export const getWeapons = list<Weapon>("weapons");
export const getWeapon = one<Weapon>("weapons");
export const getArtifacts = list<Artifact>("artifacts");
export const getArtifact = one<Artifact>("artifacts");
export const getMaterials = list<Material>("materials");
export const getMaterial = one<Material>("materials");
export const getTalent = one<Talent>("talents");
export const getConstellation = one<Constellation>("constellations");
export const getTrace = one<Trace>("traces");
export const getEidolon = one<Eidolon>("eidolons");
export const getLightCones = list<LightCone>("lightcones");
export const getLightCone = one<LightCone>("lightcones");
export const getRelics = list<Relic>("relics");
export const getRelic = one<Relic>("relics");
export const getForte = one<Forte>("fortes");
export const getResonanceChain = one<ResonanceChain>("resonancechains");
export const getEchoes = list<Echo>("echoes");
export const getEcho = one<Echo>("echoes");
export const getEchoSets = list<EchoSet>("echosets");
export const getEchoSet = one<EchoSet>("echosets");
export const getAgentKit = one<AgentKit>("agentkits");
// Game-wide reference tables (ZZZ "Drive Disc stats")
export const getReference = one<{ name: string; data: unknown }>("references");

export interface VersionEntry {
  version: string;
  groups: Array<{
    type: "characters" | "weapons" | "lightcones" | "artifacts" | "relics" | "bangboos";
    items: Array<{ name: string; rarity?: number | number[]; element?: string; subElement?: string; images?: Record<string, string> }>;
  }>;
}

/** What each version added (newest first) */
export async function getVersions(game: Game): Promise<ApiResponse<VersionEntry[]>> {
  const { data } = await client.get(`/${game}/versions`);
  return data;
}

export interface BannerUnit {
  name: string;
  rarity?: number;
  kind: "character" | "weapon";
  rateUp?: boolean;
}

export interface Banner {
  name: string;
  title?: string;
  kind?: "character" | "weapon" | "chronicled";
  collab?: boolean;
  version?: string;
  start?: string;
  end?: string;
  featured: BannerUnit[];
  image?: string;
  source?: string;
}

export interface BannerHistory {
  source: string | null;
  banners: Banner[];
  /** "character:Name" / "weapon:Name" → its rarity, element and images on this site */
  units: Record<string, { rarity?: number; element?: string; images?: Record<string, string> }>;
}

export async function getBanners(game: Game, unit?: { name: string; kind: "character" | "weapon" }): Promise<ApiResponse<BannerHistory>> {
  const { data } = await client.get(`/${game}/banners`, { params: unit ? { unit: unit.name, kind: unit.kind } : undefined });
  return data;
}

export interface PlanEntry {
  character: string;
  levelFrom: number;
  levelTo: number;
  skillFrom: number;
  skillTo: number;
  weapon?: string;
  weaponFrom?: number;
  weaponTo?: number;
  /** Count the one-time nodes (HSR traces, WuWa inherent/stat nodes, Endfield attributes); default yes */
  nodes?: boolean;
}

export interface Plan {
  entries: PlanEntry[];
  /** In-game UID used for the showcase import */
  uid?: string;
  /** Material key (id, or name) → count owned */
  inventory: Record<string, number>;
}

export async function getPlan(game: Game): Promise<ApiResponse<Plan>> {
  const { data } = await client.get(`/${game}/plan`);
  return data;
}

export async function savePlan(game: Game, plan: Plan): Promise<ApiResponse<Plan>> {
  const { data } = await client.put(`/${game}/plan`, plan);
  return data;
}

/** A character of the player's in-game showcase (Enka.Network) */
export interface ShowcaseCharacter {
  /** English name (the planner's key) */
  character: string;
  displayName?: string;
  images?: Record<string, string>;
  level: number;
  /** Lowest of the main skill levels */
  skill: number;
  weapon?: string;
  weaponLevel?: number;
  /** HSR: every major trace and stat node already unlocked */
  nodesDone?: boolean;
}

export async function getAccount(game: Game, uid: string): Promise<ApiResponse<{ nickname?: string; characters: ShowcaseCharacter[] }>> {
  const { data } = await client.get(`/${game}/account/${uid}`);
  return data;
}

/** An in-game event (official announcements) */
export interface GameEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  image?: string;
}

export async function getEvents(game: Game): Promise<ApiResponse<{ source: string; events: GameEvent[] } | null>> {
  const { data } = await client.get(`/${game}/events`);
  return data;
}

/** Where a material drops (the planner's "Where to farm") */
export interface FarmInfo {
  name: string;
  rarity?: number;
  source?: string[];
  /** Genshin: the domain and its days (1 = Monday … 7 = Sunday) */
  domain?: string;
  days?: number[];
  images?: Record<string, string>;
}

export async function getFarmInfo(game: Game, names: string[]): Promise<ApiResponse<FarmInfo[]>> {
  const { data } = await client.get(`/${game}/farm`, { params: { names: names.join("|") } });
  return data;
}

/** Characters / weapons whose costs include a material */
export async function getMaterialUsage(game: Game, name: string): Promise<ApiResponse<unknown[]>> {
  const { data } = await client.get(`/${game}/materials/${encodeURIComponent(name)}/usage`);
  return data;
}
export const getBangboos = list<Bangboo>("bangboos");
export const getBangboo = one<Bangboo>("bangboos");

export async function getStats(
  game: Game
): Promise<ApiResponse<GameStats> & { game: string }> {
  const { data } = await client.get(`/${game}/stats`);
  return data;
}

// Kit enhancements (all mechanics of a game, or those of one character)
export async function getEnhancements(
  game: Game,
  character?: string
): Promise<ApiResponse<EnhancementBundle>> {
  const { data } = await client.get(`/${game}/enhancements`, {
    params: character ? { character } : {},
  });
  return data;
}

// ── Synchronisation ───────────────────────────────────────────────────────────

export async function getSyncStatus(): Promise<SyncStatus> {
  const { data } = await client.get("/sync/status");
  return data;
}

export async function getChangelog(game?: string, limit = 30): Promise<{ data: ChangelogEntry[] }> {
  const { data } = await client.get("/sync/changelog", { params: { ...(game ? { game } : {}), limit } });
  return data;
}

/** Sync one game, or every game with `game = "all"`. */
export async function runSync(game: string, opts: { dryRun?: boolean; force?: boolean } = {}): Promise<SyncReport[]> {
  const params: Record<string, string> = {};
  if (opts.dryRun) params.dryRun = "1";
  if (opts.force) params.force = "1";
  const { data } = await client.post(`/sync/${game}`, null, { params, timeout: 15 * 60 * 1000 });
  return Array.isArray(data.data) ? data.data : [data.data];
}

export async function rollbackSync(game: string): Promise<void> {
  await client.post(`/sync/${game}/rollback`);
}

export async function markUpdatesSeen(): Promise<void> {
  await client.post("/sync/seen");
}

export async function getEnhancementStatus(): Promise<{ data: EnhancementLoadStatus }> {
  const { data } = await client.get("/enhancements/status");
  return data;
}

export async function reloadEnhancements(): Promise<{ data: EnhancementLoadStatus }> {
  const { data } = await client.post("/enhancements/reload");
  return data;
}

// Search across every game
export interface SearchResult {
  game: Game;
  type: string; // page path under /:game/ (characters, weapons, …)
  label: string;
  name: string;
  rarity?: number;
  element?: string;
  path?: string;
  weaponType?: string;
  images?: Record<string, string>;
}

export async function searchAll(q: string, game?: Game): Promise<{ success: boolean; data: SearchResult[] }> {
  const { data } = await client.get("/search", { params: { q, ...(game ? { game } : {}) } });
  return data;
}
