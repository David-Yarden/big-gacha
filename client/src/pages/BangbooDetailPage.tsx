import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { RarityStars } from "@/components/shared/RarityStars";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getBangboo } from "@/lib/api";
import { GameText } from "@/components/character/shared";
import type { Bangboo, Game } from "@/lib/types";

type Skill = NonNullable<Bangboo["skills"]>[number];

function SkillCard({ skill }: { skill: Skill }) {
  const max = Math.max(1, skill.maxLevel || 1);
  const [level, setLevel] = useState(max);
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{skill.kind}</Badge>
            <h3 className="font-semibold">{skill.name}</h3>
          </div>
          {max > 1 && <span className="text-sm text-muted-foreground">Lv. {level}</span>}
        </div>
        {(skill.descs?.[level - 1] ?? skill.desc) && (
          <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            <GameText text={skill.descs?.[level - 1] ?? skill.desc ?? ""} />
          </div>
        )}
        {(skill.params.length > 0 || skill.descs) && (
          <>
            {max > 1 && <Slider min={1} max={max} step={1} value={[level]} onValueChange={([v]) => setLevel(v)} />}
            {skill.params.length > 0 && <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <tbody>
                  {skill.params.map((p, i) => (
                    <tr key={`${p.name}-${i}`} className="border-b last:border-0">
                      <td className="px-3 py-1.5 text-muted-foreground">{p.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-amber-400">{p.values[level - 1] ?? p.values[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function BangbooDetailPage() {
  const { game, name } = useParams<{ game: string; name: string }>();
  const { data, loading, error } = useApiQuery(() => getBangboo(game as Game, name!), [game, name]);
  const b = data?.data;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to={`/${game}/bangboos`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" /> Bangboos
        </Button>
      </Link>
      {error || !b ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error ?? "Bangboo not found"}</div>
      ) : (
        <>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {b.images?.icon && (
            <Card className="w-40 shrink-0 gap-0 overflow-hidden py-0">
              <ImageWithFallback src={b.images.icon} alt={b.name} className="aspect-square w-full object-contain p-2" />
            </Card>
          )}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{b.name}</h1>
              <RarityStars rarity={b.rarity} className="text-2xl" />
              {b.version && <Badge variant="outline">v{b.version}</Badge>}
            </div>
            {b.description && <p className="max-w-3xl text-sm italic text-muted-foreground">{b.description}</p>}
          </div>
          </div>
          <div className="space-y-4">
            {(b.skills ?? []).map((s) => (
              <SkillCard key={s.kind} skill={s} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
