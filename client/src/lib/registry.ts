/**
 * Typed access to the shared game registry (../shared/games.json),
 * the same file the API reads.
 */
import registry from "@shared/games.json";
import type { Game } from "./types";

export type ResourceKind = "characters" | "versions" | "banners" | "planner" | "weapons" | "gear" | "echoes" | "bangboos" | "materials" | "cards" | "decks";

export interface RegistryResource {
  path: string;
  label: string;
  kind: ResourceKind;
}

export interface RegistryGame {
  id: Game;
  name: string;
  shortName: string;
  description: string;
  available: boolean;
  logo: string;
  logoClassName?: string;
  resources: RegistryResource[];
  elements?: string[];
  weaponTypes?: string[];
  regions?: string[];
  /** Label of the "regions" filter (ZZZ: "Faction") */
  regionLabel?: string;
  /** Emblem per region / faction name */
  regionIcons?: Record<string, string>;
  paths?: string[];
  /** ZZZ agent specialties (also the W-Engine types); Endfield operator classes */
  specialties?: string[];
  /** Character rarities, highest first (default [5, 4]) */
  rarities?: number[];
}

export const REGISTRY_GAMES = registry.games as RegistryGame[];

export function registryGame(id?: string): RegistryGame | undefined {
  return REGISTRY_GAMES.find((g) => g.id === id);
}

/** Display name of a resource in a game ("Agents" for ZZZ characters…). */
export function resourceLabel(game: string | undefined, path: string, fallback: string): string {
  return registryGame(game)?.resources.find((r) => r.path === path)?.label ?? fallback;
}
