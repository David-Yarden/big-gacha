import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/FilterBar";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { getEchoSets } from "@/lib/api";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { wuwaEchoSetIconUrl } from "@/lib/images";
import { WUWA_ELEMENTS, WUWA_ELEMENT_COLOR_MAP } from "@/lib/constants";
import type { Game, EchoSet } from "@/lib/types";
import type { FilterGroup, SortOption } from "@/components/shared/FilterBar";

const ECHOSET_FILTERS: FilterGroup[] = [
  {
    key: "element",
    label: "Element",
    options: WUWA_ELEMENTS.map((el) => ({ value: el, label: el })),
  },
];

const SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "Name" },
];

function EchoSetCard({ echoSet, game }: { echoSet: EchoSet; game: string }) {
  const elementClass = echoSet.element
    ? (WUWA_ELEMENT_COLOR_MAP[echoSet.element] ?? "bg-muted")
    : "bg-muted";

  return (
    <Link to={`/${game}/echosets/${encodeURIComponent(echoSet.name)}`} className="h-full">
      <Card className="group h-full flex flex-col overflow-hidden transition-colors hover:border-primary/40">
        <div className="relative flex h-32 shrink-0 items-center justify-center bg-muted/10">
          <ImageWithFallback
            src={wuwaEchoSetIconUrl(echoSet.images)}
            alt={echoSet.name}
            className="h-full w-full object-contain p-2"
          />
          {echoSet.element ? (
            <Badge
              className={`absolute top-2 right-2 ${elementClass} border-0 text-white text-xs`}
            >
              {echoSet.element}
            </Badge>
          ) : (
            <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
              Universal
            </Badge>
          )}
        </div>
        <CardContent className="flex flex-col p-3 flex-1">
          <p className="font-semibold text-sm truncate">{echoSet.name}</p>
          {echoSet.twoPieceBonus && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {echoSet.twoPieceBonus}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function buildSort(sortBy: string, sortDir: string): string {
  const desc = sortDir === "desc";
  if (sortBy === "name") return desc ? "-name" : "name";
  return "name";
}

export function EchoSetsPage() {
  const { game } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? undefined;
  const element = searchParams.get("element") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "name";
  const sortDir = searchParams.get("sortDir") ?? "asc";

  const sort = buildSort(sortBy, sortDir);

  const { items, total, loading, error, hasMore, sentinelRef } = useInfiniteList(
    (page) =>
      getEchoSets(game as Game, {
        page,
        limit: 25,
        search,
        element,
        sort,
      }),
    [game, search, element, sort]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sonata Effects</h1>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">{total} total</span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search sonata effects..."
        filterGroups={ECHOSET_FILTERS}
        sortOptions={SORT_OPTIONS}
        defaultSortBy="name"
        defaultSortDir="asc"
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <ResourceGrid
        loading={loading && items.length === 0}
        empty={items.length === 0 && !loading}
        emptyMessage="No sonata effects found"
      >
        {items.map((s) => (
          <EchoSetCard key={s._id} echoSet={s} game={game!} />
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
          All {total} sonata effects loaded
        </p>
      )}
    </div>
  );
}
