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
  GameStats,
} from "./types";

const client = axios.create({
  baseURL: "/api",
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

// Characters
export async function getCharacters(
  game: Game,
  params?: QueryParams
): Promise<PaginatedResponse<Character>> {
  const { data } = await client.get(`/${game}/characters`, {
    params: buildParams(params),
  });
  return data;
}

export async function getCharacter(
  game: Game,
  name: string
): Promise<ApiResponse<Character>> {
  const { data } = await client.get(`/${game}/characters/${encodeURIComponent(name)}`);
  return data;
}

// Weapons
export async function getWeapons(
  game: Game,
  params?: QueryParams
): Promise<PaginatedResponse<Weapon>> {
  const { data } = await client.get(`/${game}/weapons`, {
    params: buildParams(params),
  });
  return data;
}

export async function getWeapon(
  game: Game,
  name: string
): Promise<ApiResponse<Weapon>> {
  const { data } = await client.get(`/${game}/weapons/${encodeURIComponent(name)}`);
  return data;
}

// Artifacts
export async function getArtifacts(
  game: Game,
  params?: QueryParams
): Promise<PaginatedResponse<Artifact>> {
  const { data } = await client.get(`/${game}/artifacts`, {
    params: buildParams(params),
  });
  return data;
}

export async function getArtifact(
  game: Game,
  name: string
): Promise<ApiResponse<Artifact>> {
  const { data } = await client.get(`/${game}/artifacts/${encodeURIComponent(name)}`);
  return data;
}

// Materials
export async function getMaterials(
  game: Game,
  params?: QueryParams
): Promise<PaginatedResponse<Material>> {
  const { data } = await client.get(`/${game}/materials`, {
    params: buildParams(params),
  });
  return data;
}

export async function getMaterial(
  game: Game,
  name: string
): Promise<ApiResponse<Material>> {
  const { data } = await client.get(`/${game}/materials/${encodeURIComponent(name)}`);
  return data;
}

// Talents
export async function getTalent(
  game: Game,
  name: string
): Promise<ApiResponse<Talent>> {
  const { data } = await client.get(`/${game}/talents/${encodeURIComponent(name)}`);
  return data;
}

// Constellations
export async function getConstellation(
  game: Game,
  name: string
): Promise<ApiResponse<Constellation>> {
  const { data } = await client.get(`/${game}/constellations/${encodeURIComponent(name)}`);
  return data;
}

// Stats
export async function getStats(
  game: Game
): Promise<ApiResponse<GameStats> & { game: string }> {
  const { data } = await client.get(`/${game}/stats`);
  return data;
}
