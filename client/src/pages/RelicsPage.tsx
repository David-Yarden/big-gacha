import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/FilterBar";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { GearStatTable } from "@/components/shared/GearStatTable";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { getRelics } from "@/lib/api";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { relicIconUrl } from "@/lib/images";
import type { Game, Relic } from "@/lib/types";
import { registryGame } from "@/lib/registry";
import { GameText } from "@/components/character/shared";
import type { FilterGroup, SortOption } from "@/components/shared/FilterBar";

const RELIC_FILTERS: FilterGroup[] = [
  {
    key: "type",
    label: "Type",
    options: [
      { value: "cavern", label: "Relics" },
      { value: "planar", label: "Planar Ornaments" },
    ],
  },
];

const SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "Name" },
  { value: "version", label: "Release" },
];

// Endfield set logos are black on transparent: lightened to show on the dark theme
const gearLogoClass = (game?: string) => (game === "endfield" ? "invert hue-rotate-180 opacity-85" : "");

function RelicCard({ relic, game }: { relic: Relic; game: string }) {
  const bonus = relic.setBonus?.replace(/^\d-piece set effect:\s*/i, "");
  // Long effects are cut after 4 lines: the full text shows in a bubble on hover
  const long = (bonus?.replace(/\[\[[^|\]]*\||\]\]|\*\*/g, "").length ?? 0) > 150;
  return (
    <Link to={`/${game}/relics/${encodeURIComponent(relic.name)}`} className="group/relic relative h-full">
      <Card className="group h-full flex flex-col gap-0 overflow-hidden py-0 transition-colors hover:border-primary/40">
        <div className="relative flex h-32 shrink-0 items-center justify-center bg-muted/10">
          <ImageWithFallback
            src={relicIconUrl(relic.images)}
            alt={relic.name}
            className={`h-full w-full object-contain p-2 ${gearLogoClass(game)}`}
          />
          {relic.type && relic.type !== "disc" && relic.type !== "gear" && (
            <Badge
              variant="secondary"
              className="absolute top-2 right-2 text-xs"
            >
              {relic.type === "planar" ? "Planar" : "Relic"}
            </Badge>
          )}
        </div>
        <CardContent className="flex flex-col p-3 flex-1">
          <p className="font-semibold text-sm truncate">{relic.name}</p>
          {relic.type === "disc" ? (
            // Drive Discs: both bonuses in full
            <div className="mt-1.5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              {relic.twoPieceBonus && (
                <p>
                  <span className="mr-1 font-semibold text-foreground/80">2-Pc</span>
                  <GameText text={relic.twoPieceBonus} />
                </p>
              )}
              {relic.fourPieceBonus && (
                <p>
                  <span className="mr-1 font-semibold text-foreground/80">4-Pc</span>
                  <GameText text={relic.fourPieceBonus} />
                </p>
              )}
            </div>
          ) : bonus ? (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-4">
              <span className="mr-1 font-semibold text-foreground/80">{relic.setPieces ?? 3}-Pc</span>
              <GameText text={bonus} />
            </p>
          ) : relic.twoPieceBonus ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {relic.twoPieceBonus}
            </p>
          ) : null}
        </CardContent>
      </Card>
      {long && (
        <div
          role="tooltip"
          className="pointer-events-none absolute inset-x-0 top-32 z-30 hidden rounded-xl border bg-popover p-3 text-xs leading-relaxed text-muted-foreground shadow-xl group-hover/relic:block"
        >
          <p className="mb-1 text-sm font-semibold text-foreground">{relic.name}</p>
          <span className="mr-1 font-semibold text-foreground/80">{relic.setPieces ?? 3}-Pc</span>
          <GameText text={bonus!} />
        </div>
      )}
    </Link>
  );
}

function buildSort(sortBy: string, sortDir: string): string {
  const desc = sortDir === "desc";
  if (sortBy === "version") return desc ? "-version,name" : "version,name";
  if (sortBy === "name") return desc ? "-name" : "name";
  return "name";
}

export function RelicsPage() {
  const { game } = useParams<{ game: string }>();
  const pageTitle = registryGame(game)?.resources.find((r) => r.path === "relics")?.label ?? "Relics";
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "version";
  const sortDir = searchParams.get("sortDir") ?? "desc";

  const sort = buildSort(sortBy, sortDir);

  const { items, total, loading, error, hasMore, sentinelRef } = useInfiniteList(
    (page) =>
      getRelics(game as Game, {
        page,
        limit: 25,
        search,
        type,
        sort,
      }),
    [game, search, type, sort]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">{`${total} total`}</span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search relic sets..."
        filterGroups={game === "hsr" ? RELIC_FILTERS : []}
        sortOptions={SORT_OPTIONS}
        defaultSortBy="version"
        defaultSortDir="desc"
      />

      <GearStatTable game={game!} />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <ResourceGrid
        loading={loading && items.length === 0}
        empty={items.length === 0 && !loading}
        emptyMessage="No sets found"
        columns={game === "zzz" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : undefined}
      >
        {items.map((r) => (
          <RelicCard key={r._id} relic={r} game={game!} />
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
          {`All ${total} relic sets loaded`}
        </p>
      )}
    </div>
  );
}
