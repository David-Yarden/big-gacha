/**
 * Plugins of this computer only (client/src/local/<name>/plugin.tsx): none ships with the
 * project. A plugin can add pages and links in the menu.
 */
import { createElement, Fragment, type ComponentType, type ReactNode } from "react";

export interface PluginLink {
  path: string;
  label: string;
}

export interface SitePlugin {
  /** Extra pages: paths like "/:game/something" */
  routes?: Array<{ path: string; element: ReactNode }>;
  /** Hook giving the menu links of a game (paths relative to /:game/) */
  useLinks?: (game?: string) => PluginLink[];
  /** Shown on every page (notices…) */
  overlay?: ComponentType;
}

const modules = import.meta.glob<{ default: SitePlugin }>("../local/*/plugin.tsx", { eager: true });

export const PLUGINS: SitePlugin[] = Object.values(modules).map((m) => m.default);

/** Menu links added by the plugins (the plugin list never changes at run time). */
export function usePluginLinks(game?: string): PluginLink[] {
  const links: PluginLink[] = [];
  for (const p of PLUGINS) if (p.useLinks) links.push(...p.useLinks(game));
  return links;
}

/** The plugins' overlays, rendered once by the layout. */
export function PluginOverlays() {
  return createElement(
    Fragment,
    null,
    PLUGINS.filter((p) => p.overlay).map((p, i) => createElement(p.overlay!, { key: i }))
  );
}
