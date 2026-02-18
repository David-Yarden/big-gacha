import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { getArtifacts } from "@/lib/api";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { artifactIconUrl } from "@/lib/images";
import { ARTIFACT_RARITIES } from "@/lib/constants";
import type { Game, Artifact } from "@/lib/types";
import type { FilterGroup, SortOption } from "@/components/shared/FilterBar";

const ARTIFACT_FILTERS: FilterGroup[] = [
  {
    key: "rarity",
    label: "Rarity",
    options: ARTIFACT_RARITIES.map((r) => ({
      value: String(r),
      label: "★".repeat(r),
    })),
  },
];

const SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "Name" },
  { value: "version", label: "Release" },
];

function ArtifactCard({ artifact, game }: { artifact: Artifact; game: string }) {
  const maxRarity = artifact.rarity ? Math.max(...artifact.rarity) : 0;

  return (
    <Link to={`/${game}/artifacts/${artifact.name}`}>
      <Card className="group overflow-hidden transition-colors hover:border-primary/40">
        <div className="relative flex h-32 items-center justify-center bg-rarity-5/10">
          <ImageWithFallback
            src={artifactIconUrl(artifact.images, "flower")}
            alt={artifact.name}
            className="h-full w-full object-contain p-2"
          />
        </div>
        <CardContent className="p-3">
          <p className="font-semibold text-sm truncate">{artifact.name}</p>
          {maxRarity > 0 && (
            <div className="mt-1">
              <RarityStars rarity={maxRarity} className="text-xs" />
            </div>
          )}
          {artifact.twoPieceBonus && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              2pc: {artifact.twoPieceBonus}
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
  return "name";
}

export function ArtifactsPage() {
  const { game } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? undefined;
  const rarity = searchParams.get("rarity") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "version";
  const sortDir = searchParams.get("sortDir") ?? "desc";

  const sort = buildSort(sortBy, sortDir);

  const { items, total, loading, error, hasMore, sentinelRef } = useInfiniteList(
    (page) =>
      getArtifacts(game as Game, {
        page,
        limit: 25,
        search,
        rarity: rarity ? Number(rarity) : undefined,
        sort,
      }),
    [game, search, rarity, sort]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Artifacts</h1>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">{total} total</span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search artifact sets..."
        filterGroups={ARTIFACT_FILTERS}
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
        emptyMessage="No artifact sets found"
      >
        {items.map((a) => (
          <ArtifactCard key={a._id} artifact={a} game={game!} />
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
          All {total} artifact sets loaded
        </p>
      )}
    </div>
  );
}
