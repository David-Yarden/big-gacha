import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/FilterBar";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { getLightCones } from "@/lib/api";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { lightConePreviewUrl, hsrPathIconUrl } from "@/lib/images";
import { registryGame } from "@/lib/registry";
import {
  HSR_LC_RARITIES,
  HSR_PATH_COLOR_MAP,
  RARITY_COLOR_MAP,
} from "@/lib/constants";
import type { Game, LightCone } from "@/lib/types";
import type { FilterGroup, SortOption } from "@/components/shared/FilterBar";

const LC_FILTERS: FilterGroup[] = [
  {
    key: "path",
    label: "Path",
    options: (registryGame("hsr")?.paths ?? []).map((p) => ({ value: p, label: p, icon: hsrPathIconUrl(p) ?? undefined })),
  },
  {
    key: "rarity",
    label: "Rarity",
    options: HSR_LC_RARITIES.map((r) => ({
      value: String(r),
      label: "★".repeat(r),
    })),
  },
];

const SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "Name" },
  { value: "version", label: "Release" },
];

type LcStats = { hp?: number; atk?: number; def?: number };

/** HP / ATK / DEF at the highest level (what players compare), not level 1. */
function maxLevelStats(lc: LightCone): (LcStats & { level: number }) | null {
  const stats = (lc as { stats?: Record<string, LcStats> }).stats;
  if (!stats) return null;
  const level = Math.max(...Object.keys(stats).map(Number).filter((n) => stats[n]?.atk != null));
  return Number.isFinite(level) ? { level, ...stats[level] } : null;
}

function LightConeCard({ lc, game }: { lc: LightCone; game: string }) {
  const rarityClass = RARITY_COLOR_MAP[lc.rarity] ?? "bg-muted";
  const max = maxLevelStats(lc);
  const pathClass = lc.path ? (HSR_PATH_COLOR_MAP[lc.path] ?? "bg-muted") : "bg-muted";

  return (
    <Link to={`/${game}/lightcones/${encodeURIComponent(lc.name)}`}>
      <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-primary/40">
        <div className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden ${rarityClass}/15`}>
          {/* In-game card art (tilted card), shown whole */}
          <ImageWithFallback
            src={lightConePreviewUrl(lc.images)}
            alt={lc.name}
            className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
          />
          {lc.path && (
            <Badge
              className={`absolute top-2 right-2 ${pathClass} border-0 text-white text-xs flex items-center gap-1`}
            >
              {hsrPathIconUrl(lc.path) && (
                <img src={hsrPathIconUrl(lc.path)!} className="h-3.5 w-3.5" alt="" />
              )}
              {lc.path}
            </Badge>
          )}
        </div>
        <CardContent className="p-3">
          <p className="font-semibold text-sm truncate">{lc.name}</p>
          <div className="mt-1">
            <RarityStars rarity={lc.rarity} className="text-xs" />
          </div>
          {max && (
            <p className="mt-1 flex flex-wrap gap-x-2.5 text-xs text-muted-foreground" title={`Base stats at level ${max.level}`}>
              <span>HP {Math.floor(max.hp ?? 0)}</span>
              <span>ATK {Math.floor(max.atk ?? 0)}</span>
              <span>DEF {Math.floor(max.def ?? 0)}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function buildSort(sortBy: string, sortDir: string): string {
  const desc = sortDir === "desc";
  if (sortBy === "version") return desc ? "-version,name" : "version,name";
  if (sortBy === "name") return desc ? "-name" : "name";
  return "-rarity,name";
}

export function LightConesPage() {
  const { game } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? undefined;
  const path = searchParams.get("path") ?? undefined;
  const rarity = searchParams.get("rarity") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "version";
  const sortDir = searchParams.get("sortDir") ?? "desc";

  const sort = buildSort(sortBy, sortDir);

  const { items, total, loading, error, hasMore, sentinelRef } = useInfiniteList(
    (page) =>
      getLightCones(game as Game, {
        page,
        limit: 25,
        search,
        path,
        rarity: rarity ? Number(rarity) : undefined,
        sort,
      }),
    [game, search, path, rarity, sort]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Light Cones</h1>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">{`${total} total`}</span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search light cones..."
        filterGroups={LC_FILTERS}
        sortOptions={SORT_OPTIONS}
        defaultSortBy="version"
        defaultSortDir="desc"
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <ResourceGrid
        loading={loading && items.length === 0}
        empty={items.length === 0 && !loading}
        emptyMessage="No light cones found"
        columns="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        {items.map((lc) => (
          <LightConeCard key={lc._id} lc={lc} game={game!} />
        ))}
      </ResourceGrid>

      {loading && items.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <div ref={sentinelRef} className="h-px" />

      {!hasMore && items.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-2">
          {`All ${total} light cones loaded`}
        </p>
      )}
    </div>
  );
}
