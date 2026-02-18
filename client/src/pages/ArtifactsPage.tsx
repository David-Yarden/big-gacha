import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { Pagination } from "@/components/shared/Pagination";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { getArtifacts } from "@/lib/api";
import { useApiQuery } from "@/hooks/useApiQuery";
import { artifactIconUrl } from "@/lib/images";
import { ARTIFACT_RARITIES } from "@/lib/constants";
import type { Game, Artifact } from "@/lib/types";
import type { FilterGroup } from "@/components/shared/FilterBar";

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

function ArtifactCard({ artifact, game }: { artifact: Artifact; game: string }) {
  const maxRarity = artifact.rarity
    ? Math.max(...artifact.rarity)
    : 0;

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

export function ArtifactsPage() {
  const { game } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? undefined;

  const { data, loading, error } = useApiQuery(
    () =>
      getArtifacts(game as Game, {
        page,
        limit: 20,
        search,
        sort: "name",
      }),
    [game, page, search]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Artifacts</h1>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total} total
          </span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search artifact sets..."
        filterGroups={ARTIFACT_FILTERS}
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <ResourceGrid
        loading={loading}
        empty={(data?.data.length ?? 0) === 0 && !loading}
        emptyMessage="No artifact sets found"
      >
        {data?.data.map((a) => (
          <ArtifactCard key={a._id} artifact={a} game={game!} />
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
