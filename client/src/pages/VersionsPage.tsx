/**
 * What each version of a game added: characters, weapons, sets, Bangboos…
 * Newest version first; the version chips at the top switch between them.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getVersions, type VersionEntry } from "@/lib/api";
import { gameUi } from "@/lib/gameUi";
import { registryGame, resourceLabel } from "@/lib/registry";
import { RARITY_COLOR_MAP } from "@/lib/constants";
import {
  weaponIconUrl,
  wuwaWeaponIconUrl,
  lightConePreviewUrl,
  artifactIconUrl,
  relicIconUrl,
} from "@/lib/images";
import { cn } from "@/lib/utils";
import type { Game } from "@/lib/types";

type Group = VersionEntry["groups"][number];
type Item = Group["items"][number];

const FALLBACK_LABELS: Record<Group["type"], string> = {
  characters: "Characters",
  weapons: "Weapons",
  lightcones: "Light Cones",
  artifacts: "Artifacts",
  relics: "Relics",
  bangboos: "Bangboos",
};

function iconFor(game: string, type: Group["type"], images?: Record<string, string>): string | null {
  switch (type) {
    case "characters":
      return gameUi(game).portrait(images);
    case "weapons":
      return game === "wuwa" ? wuwaWeaponIconUrl(images) : weaponIconUrl(images);
    case "lightcones":
      return lightConePreviewUrl(images);
    case "artifacts":
      return artifactIconUrl(images);
    case "relics":
      return relicIconUrl(images);
    default:
      return images?.icon ?? null;
  }
}

const topRarity = (r: Item["rarity"]) => (Array.isArray(r) ? Math.max(...r) : r ?? 0);

function ItemCard({ game, type, item }: { game: string; type: Group["type"]; item: Item }) {
  const rarity = topRarity(item.rarity);
  const big = type === "characters";
  return (
    <Link
      to={`/${game}/${type}/${encodeURIComponent(item.name)}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-card/60 transition-colors hover:border-primary/40"
    >
      <div className={cn("relative flex aspect-square items-center justify-center", `${RARITY_COLOR_MAP[rarity] ?? "bg-muted"}/15`)}>
        <ImageWithFallback
          src={iconFor(game, type, item.images)}
          alt={item.name}
          className={cn("h-full w-full object-contain transition-transform duration-300 group-hover:scale-105", !big && "p-2")}
        />
      </div>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <span className="truncate text-xs font-semibold">{item.name}</span>
        {rarity > 0 && type !== "relics" && type !== "artifacts" && <RarityStars rarity={rarity} className="shrink-0 text-[10px]" />}
      </div>
    </Link>
  );
}

export function VersionsPage() {
  const { game = "genshin" } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error } = useApiQuery(() => getVersions(game as Game), [game]);
  const versions = data?.data ?? [];
  const selected = searchParams.get("v") ?? versions[0]?.version;
  const entry = useMemo(() => versions.find((v) => v.version === selected) ?? versions[0], [versions, selected]);
  const reg = registryGame(game);

  // A version that does not exist (other game, typo) falls back to the newest one
  useEffect(() => {
    if (versions.length && selected && !versions.some((v) => v.version === selected)) {
      searchParams.delete("v");
      setSearchParams(searchParams, { replace: true });
    }
  }, [versions, selected, searchParams, setSearchParams]);

  const count = (v: VersionEntry) => v.groups.reduce((n, g) => n + g.items.length, 0);
  const newChars = entry?.groups.find((g) => g.type === "characters")?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Versions</h1>
          <p className="text-sm text-muted-foreground">What each {reg?.shortName ?? ""} update added</p>
        </div>
      </div>

      {loading && !versions.length && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {versions.length > 0 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Version">
          {versions.map((v) => (
            <button
              key={v.version}
              type="button"
              role="tab"
              aria-selected={v.version === entry?.version}
              onClick={() => {
                searchParams.set("v", v.version);
                setSearchParams(searchParams, { replace: true });
              }}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors",
                v.version === entry?.version
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/[0.08] text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {v.version}
              <span className="ml-1.5 text-[10px] font-normal opacity-70">{count(v)}</span>
            </button>
          ))}
        </div>
      )}

      {entry && (
        <div className="space-y-8">
          {/* Headline: the new characters, large */}
          {newChars.length > 0 && (
            <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-primary/10 via-card/60 to-card/60 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Version {entry.version}</p>
              <h2 className="mt-1 text-xl font-bold">
                {newChars.length === 1 ? newChars[0].name : newChars.map((c) => c.name).join(", ")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {newChars.length} new {resourceLabel(game, "characters", "characters").toLowerCase()}
                {entry.groups.length > 1 &&
                  ` · ${entry.groups
                    .filter((g) => g.type !== "characters")
                    .map((g) => `${g.items.length} ${resourceLabel(game, g.type, FALLBACK_LABELS[g.type]).toLowerCase()}`)
                    .join(" · ")}`}
              </p>
            </section>
          )}

          {entry.groups.map((g) => (
            <section key={g.type} className="space-y-3">
              <h3 className="flex items-baseline gap-2 text-lg font-semibold">
                {resourceLabel(game, g.type, FALLBACK_LABELS[g.type])}
                <span className="text-sm font-normal text-muted-foreground">{g.items.length}</span>
              </h3>
              <div
                className={cn(
                  "grid gap-3",
                  g.type === "characters"
                    ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
                    : "grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
                )}
              >
                {g.items.map((it) => (
                  <ItemCard key={it.name} game={game} type={g.type} item={it} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && !error && versions.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No release versions known for this game yet.</p>
      )}
    </div>
  );
}
