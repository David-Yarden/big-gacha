import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getArtifact } from "@/lib/api";
import { artifactIconUrl } from "@/lib/images";
import type { Game } from "@/lib/types";

const PIECE_LABELS: Record<string, string> = {
  flower: "Flower of Life",
  plume: "Plume of Death",
  sands: "Sands of Eon",
  goblet: "Goblet of Eonothem",
  circlet: "Circlet of Logos",
};

export function ArtifactDetailPage() {
  const { game, name } = useParams<{ game: string; name: string }>();

  const { data, loading, error } = useApiQuery(
    () => getArtifact(game as Game, name!),
    [game, name]
  );

  const artifact = data?.data;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !artifact) {
    return (
      <div className="space-y-4">
        <Link to={`/${game}/artifacts`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Artifact set not found"}
        </div>
      </div>
    );
  }

  const maxRarity = artifact.rarity ? Math.max(...artifact.rarity) : 0;
  const pieces = artifact.pieces ?? {};

  return (
    <div className="space-y-6">
      <Link to={`/${game}/artifacts`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" /> Artifacts
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="w-full md:w-48 shrink-0">
          <Card className="overflow-hidden bg-rarity-5/5">
            <ImageWithFallback
              src={artifactIconUrl(artifact.images, "flower")}
              alt={artifact.name}
              className="w-full h-48 object-contain p-4"
            />
          </Card>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{artifact.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              {maxRarity > 0 && (
                <RarityStars rarity={maxRarity} className="text-lg" />
              )}
              {artifact.version && (
                <Badge variant="secondary">v{artifact.version}</Badge>
              )}
            </div>
          </div>

          {/* Set bonuses */}
          <div className="space-y-3">
            {artifact.twoPieceBonus && (
              <div>
                <Badge variant="outline" className="mb-1">
                  2-Piece Bonus
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {artifact.twoPieceBonus}
                </p>
              </div>
            )}
            {artifact.fourPieceBonus && (
              <div>
                <Badge variant="outline" className="mb-1">
                  4-Piece Bonus
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {artifact.fourPieceBonus}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Individual pieces */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Pieces</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            ["flower", "plume", "sands", "goblet", "circlet"] as const
          ).map((pieceKey) => {
            const piece = pieces[pieceKey];
            if (!piece) return null;
            return (
              <Card key={pieceKey} className="overflow-hidden">
                <div className="flex h-16 items-center gap-3 bg-muted/20 px-4">
                  <ImageWithFallback
                    src={artifactIconUrl(artifact.images, pieceKey)}
                    alt={piece.name}
                    className="h-12 w-12 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {piece.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {PIECE_LABELS[pieceKey]}
                    </p>
                  </div>
                </div>
                {piece.description && (
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground line-clamp-4">
                      {piece.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
