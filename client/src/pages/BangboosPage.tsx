import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars, rarityLabel, rankIcon } from "@/components/shared/RarityStars";
import { getBangboos } from "@/lib/api";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { RARITY_COLOR_MAP } from "@/lib/constants";
import { GameText } from "@/components/character/shared";
import type { Game, Bangboo } from "@/lib/types";
import type { FilterGroup, SortOption } from "@/components/shared/FilterBar";

const SORT_OPTIONS: SortOption[] = [{ value: "name", label: "Name" }];

function BangbooCard({ bangboo, game }: { bangboo: Bangboo; game: string }) {
  const rarityClass = RARITY_COLOR_MAP[bangboo.rarity] ?? "bg-muted";
  const active = bangboo.skills?.find((s) => s.kind === "Active Skill");
  return (
    <Link to={`/${game}/bangboos/${encodeURIComponent(bangboo.name)}`} className="h-full">
      <Card className="group flex h-full flex-col gap-0 overflow-hidden py-0 transition-colors hover:border-primary/40">
        <div className={`flex items-center gap-3 border-b p-3 ${rarityClass}/15`}>
          <ImageWithFallback
            src={bangboo.images?.icon ?? null}
            alt=""
            fallbackText={bangboo.name.slice(0, 1)}
            className="h-12 w-12 shrink-0 rounded-full object-contain"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{bangboo.name}</p>
            <RarityStars rarity={bangboo.rarity} className="text-sm" />
          </div>
        </div>
        <CardContent className="flex-1 p-3 text-xs leading-relaxed text-muted-foreground">
          {active ? (
            <>
              <p className="mb-1 font-semibold text-foreground/85">{active.name}</p>
              <p className="line-clamp-4 whitespace-pre-line">
                <GameText text={active.desc ?? ""} />
              </p>
            </>
          ) : (
            bangboo.description
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export function BangboosPage() {
  const { game } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? undefined;
  const rarity = searchParams.get("rarity") ?? undefined;
  const sortDir = searchParams.get("sortDir") ?? "asc";

  const filters: FilterGroup[] = [
    { key: "rarity", label: "Rank", options: [5, 4].map((r) => ({ value: String(r), label: rarityLabel(game, r), icon: rankIcon(game, r) })) },
  ];

  const { items, total, loading, error, hasMore, sentinelRef } = useInfiniteList(
    (page) =>
      getBangboos(game as Game, {
        page,
        limit: 30,
        search,
        rarity: rarity ? Number(rarity) : undefined,
        sort: sortDir === "desc" ? "-name" : "-rarity,name",
      }),
    [game, search, rarity, sortDir]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bangboos</h1>
        {total > 0 && <span className="text-sm text-muted-foreground">{`${total} total`}</span>}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search Bangboos..."
        filterGroups={filters}
        sortOptions={SORT_OPTIONS}
        defaultSortBy="name"
        defaultSortDir="asc"
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}

      <ResourceGrid
        loading={loading && items.length === 0}
        empty={items.length === 0 && !loading}
        emptyMessage="No Bangboo found"
        columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {items.map((b) => (
          <BangbooCard key={b._id} bangboo={b} game={game!} />
        ))}
      </ResourceGrid>

      {loading && items.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={sentinelRef} className="h-px" />
      {!hasMore && items.length > 0 && <p className="py-2 text-center text-xs text-muted-foreground">{`All ${total} Bangboos loaded`}</p>}
    </div>
  );
}
