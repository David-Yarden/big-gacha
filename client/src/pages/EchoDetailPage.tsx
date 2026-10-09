import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getEcho } from "@/lib/api";
import { wuwaEchoIconUrl } from "@/lib/images";
import { WUWA_ELEMENT_COLOR_MAP, WUWA_ECHO_CLASSES } from "@/lib/constants";
import type { Game } from "@/lib/types";

const COST_LABEL: Record<number, string> = {
  1: "1✦  (1-cost)",
  3: "3✦  (3-cost)",
  4: "4✦  (4-cost)",
};

export function EchoDetailPage() {
  const { game, name } = useParams<{ game: string; name: string }>();

  const { data, loading, error } = useApiQuery(
    () => getEcho(game as Game, name!),
    [game, name]
  );

  const echo = data?.data;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !echo) {
    return (
      <div className="space-y-4">
        <Link to={`/${game}/echoes`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Echo not found"}
        </div>
      </div>
    );
  }

  const elementClass = echo.element
    ? (WUWA_ELEMENT_COLOR_MAP[echo.element] ?? "bg-muted")
    : null;

  return (
    <div className="space-y-6">
      <Link to={`/${game}/echoes`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" /> Echoes
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="w-full md:w-48 shrink-0">
          <Card className="overflow-hidden bg-muted/10">
            <ImageWithFallback
              src={wuwaEchoIconUrl(echo.images)}
              alt={echo.name}
              className="w-full h-48 object-contain p-4"
            />
          </Card>
        </div>

        <div className="flex-1 space-y-3">
          <h1 className="text-3xl font-bold">{echo.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {echo.element && elementClass && (
              <Badge className={`${elementClass} border-0 text-white`}>
                {echo.element}
              </Badge>
            )}
            {echo.echoClass && (
              <Badge variant="secondary">
                {WUWA_ECHO_CLASSES[echo.echoClass]?.label ?? echo.echoClass}
              </Badge>
            )}
            {echo.cost != null && (
              <Badge variant="outline">{COST_LABEL[echo.cost] ?? `${echo.cost}✦`}</Badge>
            )}
            {echo.sonataSet && (
              <Link to={`/${game}/echosets/${encodeURIComponent(echo.sonataSet)}`}>
                <Badge variant="outline" className="hover:border-primary/50 cursor-pointer">
                  {echo.sonataSet}
                </Badge>
              </Link>
            )}
          </div>

          {echo.description && (
            <p className="text-sm text-muted-foreground">{echo.description}</p>
          )}

          {echo.mainStatOptions && echo.mainStatOptions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Main Stat Options</p>
              <div className="flex flex-wrap gap-1.5">
                {echo.mainStatOptions.map((stat) => (
                  <Badge key={stat} variant="secondary" className="text-xs">{stat}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Echo Skill */}
      {echo.skill && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{echo.skill.name ?? "Echo Skill"}</h3>
              {echo.skill.cooldown != null && (
                <span className="text-xs text-muted-foreground">
                  CD: {echo.skill.cooldown}s
                </span>
              )}
            </div>
            {echo.skill.desc && (
              <p className="text-sm text-muted-foreground">{echo.skill.desc}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
