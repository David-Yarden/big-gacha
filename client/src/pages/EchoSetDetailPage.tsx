import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { renderMarkdownText } from "@/components/character/shared";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getEchoSet, getEchoes } from "@/lib/api";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { WUWA_ELEMENT_COLOR_MAP } from "@/lib/constants";
import type { Game } from "@/lib/types";

export function EchoSetDetailPage() {
  const { game, name } = useParams<{ game: string; name: string }>();

  const { data, loading, error } = useApiQuery(
    () => getEchoSet(game as Game, name!),
    [game, name]
  );

  const echoSet = data?.data;

  // Echoes that can roll this set
  const { data: echoesData } = useApiQuery(
    () => getEchoes(game as Game, { sonataSets: name!, limit: 100, sort: "-cost,name", fields: "name,cost,images" }),
    [game, name]
  );
  const echoes = echoesData?.data ?? [];

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
        {([
          [1, echoSet.onePieceBonus],
          [2, echoSet.twoPieceBonus],
          [3, echoSet.threePieceBonus],
          [5, echoSet.fivePieceBonus],
        ] as const)
          .filter(([, text]) => text)
          .map(([n, text]) => (
            <div key={n} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <Badge variant="outline">{n}-Piece Bonus</Badge>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{renderMarkdownText(text!)}</p>
            </div>
          ))}
      </div>

      {echoes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Echoes <span className="text-sm font-normal text-muted-foreground">({echoes.length})</span>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
            {echoes.map((e) => (
              <Link
                key={e._id}
                to={`/${game}/echoes/${encodeURIComponent(e.name)}`}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-2 text-center transition-colors hover:border-primary/40"
              >
                <ImageWithFallback src={e.images?.icon ?? null} alt="" className="h-14 w-14 object-contain" />
                <span className="line-clamp-2 text-xs font-medium leading-tight">{e.name}</span>
                {e.cost != null && <span className="text-[11px] text-muted-foreground">Cost {e.cost}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Description */}
      {echoSet.description && (
        <p className="text-sm text-muted-foreground">{echoSet.description}</p>
      )}
    </div>
  );
}
