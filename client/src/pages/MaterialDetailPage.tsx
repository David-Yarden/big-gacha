import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getMaterial, getMaterialUsage } from "@/lib/api";
import { gameUi } from "@/lib/gameUi";
import { resourceLabel } from "@/lib/registry";
import { materialIconUrl, materialFallbackIconUrl, weaponIconUrl, wuwaWeaponIconUrl, lightConePreviewUrl } from "@/lib/images";
import { RARITY_COLOR_MAP } from "@/lib/constants";
import { formatMaterialCategory } from "@/lib/formatters";
import type { Game } from "@/lib/types";

export function MaterialDetailPage() {
  const { game, name } = useParams<{ game: string; name: string }>();

  const { data, loading, error } = useApiQuery(
    () => getMaterial(game as Game, name!),
    [game, name]
  );

  const material = data?.data;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="space-y-4">
        <Link to={`/${game}/materials`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Material not found"}
        </div>
      </div>
    );
  }

  const rarityClass = RARITY_COLOR_MAP[material.rarity ?? 1] ?? "bg-muted";

  return (
    <div className="space-y-6">
      <Link to={`/${game}/materials`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" /> Materials
        </Button>
      </Link>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="w-full md:w-48 shrink-0">
          <Card className={`overflow-hidden ${rarityClass}/10`}>
            <ImageWithFallback
              src={materialIconUrl(material.images)}
              fallbackSrc={materialFallbackIconUrl(material.images)}
              alt={material.name}
              className="w-full h-48 object-contain p-4"
            />
          </Card>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{material.name}</h1>
            <div className="mt-2 flex items-center gap-2">
              {material.rarity && (
                <RarityStars rarity={material.rarity} className="text-lg" />
              )}
              {material.category && formatMaterialCategory(material.category) && (
                <Badge variant="secondary">{formatMaterialCategory(material.category)}</Badge>
              )}
              {material.materialType && (
                <Badge variant="outline">{material.materialType}</Badge>
              )}
            </div>
          </div>

          {material.description && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {material.description}
                </p>
              </CardContent>
            </Card>
          )}

          {material.source && material.source.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Sources</h3>
              <ul className="space-y-1">
                {material.source.map((src, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {src}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {material.version && (
            <p className="text-sm text-muted-foreground">
              Added in version {material.version}
            </p>
          )}
        </div>
      </div>

      <UsedBy game={game!} name={material.name} />
    </div>
  );
}

interface Usage {
  type: "characters" | "weapons" | "lightcones";
  name: string;
  rarity?: number;
  images?: Record<string, string>;
}

function usageIcon(game: string, u: Usage): string | null {
  if (u.type === "characters") return gameUi(game).portrait(u.images);
  if (u.type === "lightcones") return lightConePreviewUrl(u.images);
  return game === "wuwa" ? wuwaWeaponIconUrl(u.images) : weaponIconUrl(u.images);
}

/** Characters and weapons whose level-up, ascension or skill costs include this material. */
function UsedBy({ game, name }: { game: string; name: string }) {
  const { data } = useApiQuery(() => getMaterialUsage(game as Game, name), [game, name]);
  const list = (data?.data ?? []) as Usage[];
  if (!list.length) return null;
  const groups = (["characters", "weapons", "lightcones"] as const)
    .map((type) => ({ type, items: list.filter((u) => u.type === type) }))
    .filter((g) => g.items.length);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Used by</h2>
      {groups.map((g) => (
        <div key={g.type} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {resourceLabel(game, g.type, g.type)} ({g.items.length})
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
            {g.items.map((u) => (
              <Link
                key={u.name}
                to={`/${game}/${u.type}/${encodeURIComponent(u.name)}`}
                className="group overflow-hidden rounded-lg border border-white/[0.08] bg-card/60 transition-colors hover:border-primary/40"
              >
                <div className={`aspect-square ${RARITY_COLOR_MAP[u.rarity ?? 0] ?? "bg-muted"}/20`}>
                  <ImageWithFallback src={usageIcon(game, u)} alt={u.name} className="h-full w-full object-contain p-1" />
                </div>
                <p className="truncate px-1.5 py-1 text-center text-xs">{u.name}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
