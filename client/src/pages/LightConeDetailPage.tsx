import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getLightCone } from "@/lib/api";
import { lightConeSplashUrl } from "@/lib/images";
import { calculateAscensionMaterials } from "@/lib/materials";
import { RARITY_COLOR_MAP, HSR_PATH_COLOR_MAP } from "@/lib/constants";
import type { Game } from "@/lib/types";
import type { MaterialCostEntry } from "@/lib/materials";

const HSR_LC_ASCENSION_LEVELS = [1, 20, 30, 40, 50, 60, 70, 80] as const;

function hsrLcLevelToPhase(level: number): number {
  if (level <= 20) return 0;
  if (level <= 30) return 1;
  if (level <= 40) return 2;
  if (level <= 50) return 3;
  if (level <= 60) return 4;
  if (level <= 70) return 5;
  return 6;
}

/**
 * Renders an HSR light cone effect template, replacing #N[format] tokens with
 * formatted numeric values. Raw param values are fractions for percentages
 * (e.g. 0.14 = 14% ER) — we detect this by looking ahead for a literal "%" in
 * the template immediately after the token, then multiply by 100.
 */
function renderEffect(template: string, values: number[]) {
  const clean = template.replace(/<[^>]+>/g, "");
  const parts = clean.split(/(#\d+\[[^\]]+\])/);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const match = part.match(/^#(\d+)\[([^\]]+)\]/);
      if (!match) return part;
      const idx = parseInt(match[1]) - 1;
      const fmt = match[2].toLowerCase();
      const raw = values[idx];
      if (raw === undefined) return part;

      // If the next text segment starts with %, the raw value is a fraction → multiply by 100
      const nextPart = parts[i + 1] ?? "";
      const isPercent = nextPart.startsWith("%");
      const n = isPercent ? raw * 100 : raw;

      let formatted: string;
      if (fmt === "f1") formatted = n.toFixed(1);
      else if (fmt === "f2") formatted = n.toFixed(2);
      else formatted = String(Math.round(n));

      return (
        <span key={i} className="font-bold text-amber-400">
          {formatted}
        </span>
      );
    }
    return part;
  });
}

function MaterialCostTable({ materials }: { materials: MaterialCostEntry[] }) {
  if (materials.length === 0) {
    return <p className="text-sm text-muted-foreground">No materials required</p>;
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-3 py-2 text-left font-medium">Material</th>
            <th className="px-3 py-2 text-right font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((mat) => (
            <tr key={mat.name} className="border-b last:border-0">
              <td className="px-3 py-1.5">{mat.name}</td>
              <td className="px-3 py-1.5 text-right font-mono">
                {mat.count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LightConeDetailPage() {
  const { game, name } = useParams<{ game: string; name: string }>();
  const [level, setLevel] = useState(80);
  const [superimposition, setSuperimposition] = useState(0);

  const { data, loading, error } = useApiQuery(
    () => getLightCone(game as Game, name!),
    [game, name]
  );

  const lc = data?.data;
  const rarityClass = RARITY_COLOR_MAP[lc?.rarity ?? 1] ?? "bg-muted";
  const pathClass = lc?.path ? (HSR_PATH_COLOR_MAP[lc.path] ?? "bg-muted") : "bg-muted";

  const ascensionPhase = hsrLcLevelToPhase(level);
  const ascensionMaterials = useMemo(
    () => calculateAscensionMaterials(lc?.costs, ascensionPhase),
    [lc?.costs, ascensionPhase]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !lc) {
    return (
      <div className="space-y-4">
        <Link to={`/${game}/lightcones`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Light cone not found"}
        </div>
      </div>
    );
  }

  const superimpositions = lc.superimpositions ?? [];
  const currentSuperimposition = superimpositions[superimposition];
  const stats = lc.stats?.[level];

  return (
    <div className="space-y-6">
      <Link to={`/${game}/lightcones`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" /> Light Cones
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="w-full md:w-64 shrink-0">
          <Card className={`overflow-hidden ${rarityClass}/10`}>
            <ImageWithFallback
              src={lightConeSplashUrl(lc.images)}
              alt={lc.name}
              className="w-full h-64 object-contain p-4"
            />
          </Card>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{lc.name}</h1>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <RarityStars rarity={lc.rarity} className="text-lg" />
              {lc.path && (
                <Badge className={`${pathClass} border-0 text-white`}>
                  {lc.path}
                </Badge>
              )}
              {lc.version && (
                <Badge variant="secondary">v{lc.version}</Badge>
              )}
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">HP </span>
                <span className="font-medium">{Math.round(stats.hp).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">ATK </span>
                <span className="font-medium">{Math.round(stats.atk).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">DEF </span>
                <span className="font-medium">{Math.round(stats.def).toLocaleString()}</span>
              </div>
            </div>
          )}

          {lc.description && (
            <p className="text-sm text-muted-foreground">{lc.description}</p>
          )}
        </div>
      </div>

      {/* Superimposition Effect */}
      {lc.effectName && superimpositions.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{lc.effectName}</h3>
              <span className="text-sm font-medium">S{superimposition + 1}</span>
            </div>
            <Slider
              min={1}
              max={superimpositions.length}
              step={1}
              value={[superimposition + 1]}
              onValueChange={([v]) => setSuperimposition(v - 1)}
            />
            <div className="flex justify-between text-xs text-muted-foreground px-0.5">
              {superimpositions.map((_, i) => (
                <span
                  key={i}
                  className={`cursor-pointer ${superimposition === i ? "text-primary font-bold" : ""}`}
                  onClick={() => setSuperimposition(i)}
                >
                  S{i + 1}
                </span>
              ))}
            </div>
            {lc.effectTemplateRaw && currentSuperimposition?.values ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {renderEffect(lc.effectTemplateRaw, currentSuperimposition.values)}
              </p>
            ) : currentSuperimposition?.description ? (
              <p className="text-sm text-muted-foreground">
                {String(currentSuperimposition.description)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Ascension Materials */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Ascension Materials</h3>
            <span className="text-sm text-muted-foreground">
              Lv. {level} (Phase {ascensionPhase})
            </span>
          </div>
          <Slider
            min={1}
            max={80}
            step={1}
            value={[level]}
            onValueChange={([v]) => setLevel(v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            {HSR_LC_ASCENSION_LEVELS.map((l) => (
              <button
                key={l}
                className={`px-1 ${level === l ? "text-primary font-bold" : ""}`}
                onClick={() => setLevel(l)}
              >
                {l}
              </button>
            ))}
          </div>
          <MaterialCostTable materials={ascensionMaterials} />
        </CardContent>
      </Card>
    </div>
  );
}
