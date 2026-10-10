import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/FilterBar";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { GearStatTable } from "@/components/shared/GearStatTable";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { getEchoSets } from "@/lib/api";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { registryGame } from "@/lib/registry";
import { renderMarkdownText } from "@/components/character/shared";
import { wuwaEchoSetIconUrl } from "@/lib/images";
import { WUWA_ELEMENT_COLOR_MAP } from "@/lib/constants";
import type { Game, EchoSet } from "@/lib/types";
import type { FilterGroup, SortOption } from "@/components/shared/FilterBar";

const ECHOSET_FILTERS: FilterGroup[] = [
  {
    key: "element",
    label: "Element",
    options: (registryGame("wuwa")?.elements ?? []).map((el) => ({ value: el, label: el })),
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
        <div className="flex items-center gap-3 border-b bg-muted/10 p-3">
          <ImageWithFallback
            src={wuwaEchoSetIconUrl(echoSet.images)}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-contain"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">{echoSet.name}</p>
            {echoSet.element ? (
              <Badge className={`mt-1 ${elementClass} border-0 text-white text-xs`}>{echoSet.element}</Badge>
            ) : (
              <Badge variant="secondary" className="mt-1 text-xs">Universal</Badge>
            )}
          </div>
        </div>
        <CardContent className="flex flex-1 flex-col gap-2 p-3">
          {([
            [1, echoSet.onePieceBonus],
            [2, echoSet.twoPieceBonus],
            [3, echoSet.threePieceBonus],
            [5, echoSet.fivePieceBonus],
          ] as const)
            .filter(([, text]) => text)
            .map(([n, text]) => (
              <div key={n} className="text-xs">
                <span className="mr-1.5 inline-block rounded bg-primary/15 px-1.5 py-0.5 font-semibold text-primary">{n}pc</span>
                <span className="text-muted-foreground whitespace-pre-line">{renderMarkdownText(text!)}</span>
              </div>
            ))}
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
          <span className="text-sm text-muted-foreground">{`${total} total`}</span>
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

      <GearStatTable game={game ?? "wuwa"} />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <ResourceGrid
        loading={loading && items.length === 0}
        empty={items.length === 0 && !loading}
        emptyMessage="No sonata effects found"
        columns="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
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
          {`All ${total} sonata effects loaded`}
        </p>
      )}
    </div>
  );
}
