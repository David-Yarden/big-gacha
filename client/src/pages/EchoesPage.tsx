import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/FilterBar";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { getEchoes } from "@/lib/api";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { registryGame } from "@/lib/registry";
import { wuwaEchoIconUrl } from "@/lib/images";
import { WUWA_ELEMENT_COLOR_MAP, WUWA_ECHO_CLASSES } from "@/lib/constants";
import type { Game, Echo } from "@/lib/types";
import type { FilterGroup, SortOption } from "@/components/shared/FilterBar";

const ECHO_FILTERS: FilterGroup[] = [
  {
    key: "echoClass",
    label: "Class",
    options: Object.entries(WUWA_ECHO_CLASSES).map(([value, { label, cost }]) => ({
      value,
      label: `${label} (${cost}✦)`,
    })),
  },
  {
    key: "element",
    label: "Element",
    options: (registryGame("wuwa")?.elements ?? []).map((el) => ({ value: el, label: el })),
  },
];

const SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "Name" },
];

const COST_LABEL: Record<number, string> = {
  1: "1✦",
  3: "3✦",
  4: "4✦",
};

function EchoCard({ echo, game }: { echo: Echo; game: string }) {
  const elementClass = echo.element
    ? (WUWA_ELEMENT_COLOR_MAP[echo.element] ?? "bg-muted")
    : "bg-muted";

  return (
    <Link to={`/${game}/echoes/${encodeURIComponent(echo.name)}`} className="h-full">
      <Card className="group h-full flex flex-col overflow-hidden transition-colors hover:border-primary/40">
        <div className="relative flex h-32 shrink-0 items-center justify-center bg-muted/10">
          <ImageWithFallback
            src={wuwaEchoIconUrl(echo.images)}
            alt={echo.name}
            className="h-full w-full object-contain p-2"
          />
          {echo.element && (
            <Badge
              className={`absolute top-2 right-2 ${elementClass} border-0 text-white text-xs`}
            >
              {echo.element}
            </Badge>
          )}
          {echo.cost != null && (
            <Badge
              variant="secondary"
              className="absolute bottom-2 right-2 text-xs font-mono"
            >
              {COST_LABEL[echo.cost] ?? `${echo.cost}✦`}
            </Badge>
          )}
        </div>
        <CardContent className="flex flex-col p-3 flex-1">
          <p className="font-semibold text-sm truncate">{echo.name}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {echo.echoClass && (
              <span>{WUWA_ECHO_CLASSES[echo.echoClass]?.label ?? echo.echoClass}</span>
            )}
            {echo.sonataSet && (
              <>
                <span className="text-border">·</span>
                <span className="truncate">{echo.sonataSet}</span>
              </>
            )}
          </div>
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

export function EchoesPage() {
  const { game } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? undefined;
  const echoClass = searchParams.get("echoClass") ?? undefined;
  const element = searchParams.get("element") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "name";
  const sortDir = searchParams.get("sortDir") ?? "asc";

  const sort = buildSort(sortBy, sortDir);

  const { items, total, loading, error, hasMore, sentinelRef } = useInfiniteList(
    (page) =>
      getEchoes(game as Game, {
        page,
        limit: 25,
        search,
        echoClass,
        element,
        sort,
      }),
    [game, search, echoClass, element, sort]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Echoes</h1>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">{`${total} total`}</span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search echoes..."
        filterGroups={ECHO_FILTERS}
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
        emptyMessage="No echoes found"
      >
        {items.map((e) => (
          <EchoCard key={e._id} echo={e} game={game!} />
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
          {`All ${total} echoes loaded`}
        </p>
      )}
    </div>
  );
}
