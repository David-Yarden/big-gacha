/**
 * Navigation per game, from the shared registry. Each entry has a "kind" shared
 * across games, so switching games keeps you on the equivalent page
 * (Genshin weapons ↔ HSR light cones ↔ WuWa weapons, artifacts ↔ relics ↔ sonata effects, …).
 */
import { registryGame, type RegistryResource } from "./registry";

export type NavLink = RegistryResource;
export type { ResourceKind } from "./registry";

const DEFAULT_NAV_LINKS: NavLink[] = [
  { label: "Characters", path: "characters", kind: "characters" },
  { label: "Materials",  path: "materials",  kind: "materials" },
];

export function linksFor(game?: string): NavLink[] {
  const resources = registryGame(game)?.resources;
  return resources && resources.length ? resources : DEFAULT_NAV_LINKS;
}

/** Path of the page equivalent to `currentPath` (of `fromGame`) in `toGame`. */
export function equivalentPath(fromGame: string | undefined, currentPath: string, toGame: string): string {
  const kind = linksFor(fromGame).find((l) => l.path === currentPath)?.kind;
  const target = kind ? linksFor(toGame).find((l) => l.kind === kind) : undefined;
  return target?.path ?? "characters";
}
