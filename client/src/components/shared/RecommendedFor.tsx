/**
 * "Recommended for": the characters whose in-game recommended build (the Build tab) lists a
 * set, with the set's rank there (Best, Alternative 1…). Shown on the set's page, for every
 * game whose characters have a build (HSR, ZZZ, WuWa, CZN), and on Endfield's weapon pages
 * (its builds recommend weapons); nothing when none lists it. ZZZ builds have a 4-piece set
 * and 2-piece sets: the rank names the slot ("4-Piece", "2-Piece", "2-Piece · Alternative 1")
 * instead of mixing both. Names are compared in English (`_name` in French).
 */
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { normalizeBuild, rankInGroup } from "@/components/character/BuildTab";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getCharacters } from "@/lib/api";
import { characterIconUrl } from "@/lib/images";
import { keyName } from "@/lib/i18n";
import type { Character, Game } from "@/lib/types";

interface Use {
  name: string;
  /** English name: the character's page */
  key: string;
  icon: string | null;
  rank: number;
  group: string;
}

/** "Best" / "Alternative n" (Endfield: "Recommended" / "Alternative"), or the slot of a ZZZ set ("4-Piece", "2-Piece · Alternative 1"). */
export function rankLabel(u: Pick<Use, "rank" | "group">): string {
  if (/^\d-Piece$/.test(u.group)) return u.rank === 0 ? u.group : `${u.group} · Alternative ${u.rank}`;
  return rankInGroup(u.group, u.rank);
}

/** Where a set stands in each character's build: its best rank over the build's groups. */
export function recommendedFor(characters: Pick<Character, "name" | "_name" | "build" | "images">[], set: string): Use[] {
  const uses: Use[] = [];
  for (const c of characters) {
    if (!c.build) continue;
    const { sets } = normalizeBuild(c.build);
    let best: Use | null = null;
    for (const g of sets) {
      const rank = g.names.indexOf(set);
      // An alternatives list counts after the recommended one (Endfield)
      const score = (r: number, group: string) => (/^alternatives?$/i.test(group) ? 100 : 0) + r;
      if (rank >= 0 && (!best || score(rank, g.label) < score(best.rank, best.group)))
        best = { name: c.name, key: keyName(c), icon: characterIconUrl(c.images as Record<string, string>), rank, group: g.label };
    }
    if (best) uses.push(best);
  }
  // The 4-piece slot before the 2-piece ones (ZZZ), recommended before alternatives (Endfield), then by rank and name
  const slot = (u: Use) => (u.group === "2-Piece" || /^alternatives?$/i.test(u.group) ? 1 : 0);
  return uses.sort((a, b) => slot(a) - slot(b) || a.rank - b.rank || a.name.localeCompare(b.name));
}

export function RecommendedFor({ game, set, who = "characters", what = "set" }: { game: Game; set: string; who?: string; what?: string }) {
  const { data } = useApiQuery(() => getCharacters(game, { limit: 100, fields: "name,build,images" }), [game]);
  const uses = recommendedFor((data?.data ?? []) as Character[], set);
  if (!uses.length) return null;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold">Recommended for</h2>
        <p className="text-xs text-muted-foreground">{`The ${who} whose in-game recommendation includes this ${what}, with its rank there.`}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {uses.map((u) => (
          <Link key={u.key} to={`/${game}/characters/${encodeURIComponent(u.key)}?tab=build`}>
            <Card className="gap-0 py-0 transition-colors hover:border-primary/40">
              <CardContent className="flex items-center gap-3 p-2.5">
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted/30">
                  <ImageWithFallback src={u.icon} alt="" className="h-11 w-11 object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{u.name}</span>
                  <span className={`block text-xs ${u.rank === 0 ? "text-amber-400" : "text-muted-foreground"}`}>{rankLabel(u)}</span>
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
