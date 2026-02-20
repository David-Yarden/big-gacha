import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getRelic } from "@/lib/api";
import { relicIconUrl } from "@/lib/images";
import type { Game } from "@/lib/types";

const CAVERN_PIECES = ["head", "hands", "body", "feet"] as const;
const PLANAR_PIECES = ["sphere", "rope"] as const;

const PIECE_LABELS: Record<string, string> = {
  head:   "Head",
  hands:  "Hands",
  body:   "Body",
  feet:   "Feet",
  sphere: "Planar Sphere",
  rope:   "Link Rope",
};

export function RelicDetailPage() {
  const { game, name } = useParams<{ game: string; name: string }>();

  const { data, loading, error } = useApiQuery(
    () => getRelic(game as Game, name!),
    [game, name]
  );

  const relic = data?.data;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !relic) {
    return (
      <div className="space-y-4">
        <Link to={`/${game}/relics`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Relic set not found"}
        </div>
      </div>
    );
  }

  const pieces = relic.pieces ?? {};
  const isPlanar = relic.type === "planar";
  const pieceKeys = isPlanar ? PLANAR_PIECES : CAVERN_PIECES;

  return (
    <div className="space-y-6">
      <Link to={`/${game}/relics`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" /> Relics
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="w-full md:w-48 shrink-0">
          <Card className="overflow-hidden bg-muted/10">
            <ImageWithFallback
              src={relicIconUrl(relic.images)}
              alt={relic.name}
              className="w-full h-48 object-contain p-4"
            />
          </Card>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{relic.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">
                {isPlanar ? "Planar Ornaments" : "Cavern Relics"}
              </Badge>
              {relic.version && (
                <Badge variant="outline">v{relic.version}</Badge>
              )}
            </div>
          </div>

          {/* Set bonuses */}
          <div className="space-y-3">
            {relic.twoPieceBonus && (
              <div>
                <Badge variant="outline" className="mb-1">
                  2-Piece Bonus
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {relic.twoPieceBonus}
                </p>
              </div>
            )}
            {relic.fourPieceBonus && (
              <div>
                <Badge variant="outline" className="mb-1">
                  4-Piece Bonus
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {relic.fourPieceBonus}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pieces */}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Pieces</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {pieceKeys.map((key) => {
            const piece = pieces[key];
            if (!piece) return null;
            return (
              <Card key={key} className="overflow-hidden">
                <div className="flex items-center gap-3 bg-muted/20 px-4 py-3">
                  {piece.icon && (
                    <ImageWithFallback
                      src={piece.icon}
                      alt={piece.name}
                      className="h-12 w-12 shrink-0 object-contain"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{piece.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {PIECE_LABELS[key]}
                    </p>
                  </div>
                </div>
                {piece.description && (
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">
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
