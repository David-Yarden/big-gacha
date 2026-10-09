import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getEchoSet } from "@/lib/api";
import { WUWA_ELEMENT_COLOR_MAP } from "@/lib/constants";
import type { Game } from "@/lib/types";

export function EchoSetDetailPage() {
  const { game, name } = useParams<{ game: string; name: string }>();

  const { data, loading, error } = useApiQuery(
    () => getEchoSet(game as Game, name!),
    [game, name]
  );

  const echoSet = data?.data;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !echoSet) {
    return (
      <div className="space-y-4">
        <Link to={`/${game}/echosets`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Sonata effect not found"}
        </div>
      </div>
    );
  }

  const elementClass = echoSet.element
    ? (WUWA_ELEMENT_COLOR_MAP[echoSet.element] ?? "bg-muted")
    : null;

  return (
    <div className="space-y-6">
      <Link to={`/${game}/echosets`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" /> Sonata Effects
        </Button>
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{echoSet.name}</h1>
        <div className="mt-2 flex items-center gap-2">
          {echoSet.element && elementClass ? (
            <Badge className={`${elementClass} border-0 text-white`}>
              {echoSet.element}
            </Badge>
          ) : (
            <Badge variant="secondary">Universal</Badge>
          )}
        </div>
      </div>

      {/* Set Bonuses */}
      <div className="space-y-4">
        {echoSet.twoPieceBonus && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <Badge variant="outline">2-Piece Bonus</Badge>
            <p className="text-sm text-muted-foreground">{echoSet.twoPieceBonus}</p>
          </div>
        )}
        {echoSet.fivePieceBonus && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <Badge variant="outline">5-Piece Bonus</Badge>
            <p className="text-sm text-muted-foreground">{echoSet.fivePieceBonus}</p>
          </div>
        )}
      </div>

      {/* Description */}
      {echoSet.description && (
        <p className="text-sm text-muted-foreground">{echoSet.description}</p>
      )}
    </div>
  );
}
