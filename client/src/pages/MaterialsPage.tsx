import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/FilterBar";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { getMaterials } from "@/lib/api";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { materialIconUrl, materialFallbackIconUrl } from "@/lib/images";
import { RARITIES, RARITY_COLOR_MAP } from "@/lib/constants";
import { formatMaterialCategory } from "@/lib/formatters";
import type { Game, Material } from "@/lib/types";
import type { FilterGroup, SortOption } from "@/components/shared/FilterBar";

const MATERIAL_FILTERS: FilterGroup[] = [
  {
    key: "rarity",
    label: "Rarity",
    options: RARITIES.map((r) => ({
      value: String(r),
      label: "★".repeat(r),
    })),
  },
];

const SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "Name" },
  { value: "version", label: "Release" },
];

function MaterialCard({ material, game }: { material: Material; game: string }) {
  const rarityClass = RARITY_COLOR_MAP[material.rarity ?? 1] ?? "bg-muted";

  return (
    <Link to={`/${game}/materials/${material.name}`}>
      <Card className="group overflow-hidden transition-colors hover:border-primary/40">
        <div
          className={`relative flex h-32 items-center justify-center ${rarityClass}/20`}
        >
          <ImageWithFallback
            src={materialIconUrl(material.images)}
            fallbackSrc={materialFallbackIconUrl(material.images)}
            alt={material.name}
            className="h-full w-full object-contain p-2"
          />
        </div>
        <CardContent className="p-3">
          <p className="font-semibold text-sm truncate">{material.name}</p>
          <div className="mt-1 flex items-center justify-between text-xs min-h-[1.25rem]">
            {material.rarity ? (
              <RarityStars rarity={material.rarity} className="text-xs" />
            ) : (
              <span />
            )}
          </div>
          {material.category && formatMaterialCategory(material.category) && (
            <Badge variant="secondary" className="mt-1 text-[10px]">
              {formatMaterialCategory(material.category)}
            </Badge>
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

export function MaterialsPage() {
  const { game } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? undefined;
  const rarity = searchParams.get("rarity") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "version";
  const sortDir = searchParams.get("sortDir") ?? "desc";

  const sort = buildSort(sortBy, sortDir);

  const { items, total, loading, error, hasMore, sentinelRef } = useInfiniteList(
    (page) =>
      getMaterials(game as Game, {
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
        <h1 className="text-2xl font-bold">Materials</h1>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">{total} total</span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search materials..."
        filterGroups={MATERIAL_FILTERS}
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
        emptyMessage="No materials found"
      >
        {items.map((m) => (
          <MaterialCard key={m._id} material={m} game={game!} />
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
          All {total} materials loaded
        </p>
      )}
    </div>
  );
}
