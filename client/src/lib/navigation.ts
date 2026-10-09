/**
 * Each nav entry has a "kind" shared across games, so switching games keeps
 * you on the equivalent page (Genshin weapons ↔ HSR light cones ↔ WuWa weapons,
 * artifacts ↔ relics ↔ sonata effects, …).
 */
export type ResourceKind = "characters" | "weapons" | "gear" | "echoes" | "materials";

export interface NavLink {
  label: string;
  path: string;
  kind: ResourceKind;
}

export const GAME_NAV_LINKS: Record<string, NavLink[]> = {
  genshin: [
    { label: "Characters", path: "characters", kind: "characters" },
    { label: "Weapons",    path: "weapons",    kind: "weapons" },
    { label: "Artifacts",  path: "artifacts",  kind: "gear" },
    { label: "Materials",  path: "materials",  kind: "materials" },
  ],
  hsr: [
    { label: "Characters",  path: "characters", kind: "characters" },
    { label: "Light Cones", path: "lightcones", kind: "weapons" },
    { label: "Relics",      path: "relics",     kind: "gear" },
    { label: "Materials",   path: "materials",  kind: "materials" },
  ],
  wuwa: [
    { label: "Characters",     path: "characters", kind: "characters" },
    { label: "Weapons",        path: "weapons",    kind: "weapons" },
    { label: "Echoes",         path: "echoes",     kind: "echoes" },
    { label: "Sonata Effects", path: "echosets",   kind: "gear" },
    { label: "Materials",      path: "materials",  kind: "materials" },
  ],
};

const DEFAULT_NAV_LINKS: NavLink[] = [
  { label: "Characters", path: "characters", kind: "characters" },
  { label: "Materials",  path: "materials",  kind: "materials" },
];

export function linksFor(game?: string): NavLink[] {
  return (game && GAME_NAV_LINKS[game]) || DEFAULT_NAV_LINKS;
}

/** Path of the page equivalent to `currentPath` (of `fromGame`) in `toGame`. */
export function equivalentPath(fromGame: string | undefined, currentPath: string, toGame: string): string {
  const kind = linksFor(fromGame).find((l) => l.path === currentPath)?.kind;
  const target = kind ? linksFor(toGame).find((l) => l.kind === kind) : undefined;
  return target?.path ?? "characters";
}
