import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/FilterBar";
import { Pagination } from "@/components/shared/Pagination";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { getMaterials } from "@/lib/api";
import { useApiQuery } from "@/hooks/useApiQuery";
import { materialIconUrl } from "@/lib/images";
import { RARITIES, RARITY_COLOR_MAP } from "@/lib/constants";
import type { Game, Material } from "@/lib/types";
import type { FilterGroup } from "@/components/shared/FilterBar";

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
            alt={material.name}
            className="h-full w-full object-contain p-2"
          />
        </div>
        <CardContent className="p-3">
          <p className="font-semibold text-sm truncate">{material.name}</p>
          <div className="mt-1 flex items-center justify-between text-xs">
            {material.rarity && (
              <RarityStars rarity={material.rarity} className="text-xs" />
            )}
          </div>
          {material.category && (
            <Badge variant="secondary" className="mt-1 text-[10px]">
              {material.category}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export function MaterialsPage() {
  const { game } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? undefined;
  const rarity = searchParams.get("rarity") ?? undefined;

  const { data, loading, error } = useApiQuery(
    () =>
      getMaterials(game as Game, {
        page,
        limit: 20,
        search,
        rarity: rarity ? Number(rarity) : undefined,
        sort: "-rarity,name",
      }),
    [game, page, search, rarity]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Materials</h1>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total} total
          </span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search materials..."
        filterGroups={MATERIAL_FILTERS}
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <ResourceGrid
        loading={loading}
        empty={(data?.data.length ?? 0) === 0 && !loading}
        emptyMessage="No materials found"
      >
        {data?.data.map((m) => (
          <MaterialCard key={m._id} material={m} game={game!} />
        ))}
      </ResourceGrid>

      {data && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          searchParams={searchParams}
          setSearchParams={setSearchParams}
        />
      )}
    </div>
  );
}
