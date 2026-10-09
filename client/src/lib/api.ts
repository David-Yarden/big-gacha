import axios from "axios";
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
