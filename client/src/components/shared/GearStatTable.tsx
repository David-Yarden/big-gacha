/**
 * Folded reference table of a game's gear stats: the main stats each slot can have
 * (value at +0 → max level) and the substats a piece can roll.
 * Data: a `references` document written by the game's seeder
 * (ZZZ "Drive Disc stats", HSR "Relic stats", Genshin "Artifact stats", WuWa "Echo stats").
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getReference } from "@/lib/api";
import type { Game } from "@/lib/types";

interface GearStats {
  rank: string;
  slots: Array<{
    slot: number | string;
    maxLevel: number;
    note?: string;
    mainStats: Array<{ name: string; base: string; max: string }>;
  }>;
  substats: Array<{ name: string; value?: string }>;
  substatNote?: string;
}

const REFERENCE: Record<string, string> = {
  zzz: "Drive Disc stats",
  hsr: "Relic stats",
  genshin: "Artifact stats",
  wuwa: "Echo stats",
};

export function GearStatTable({ game }: { game: string }) {
  const [open, setOpen] = useState(false);
  const name = REFERENCE[game];
  const { data } = useApiQuery(() => (name ? getReference(game as Game, name) : Promise.resolve(null)), [game, name]);
  const t = data?.data?.data as GearStats | undefined;
  if (!t?.slots?.length) return null;
  const rankLabel = game === "zzz" ? `${t.rank}-Rank` : t.rank;
  const slotLabel = (slot: number | string) => (typeof slot === "number" ? `Disc ${slot}` : slot);
  const hasValues = t.substats.some((s) => s.value);

  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
          <span className="font-semibold">Main stats &amp; substats ({rankLabel})</span>
          <span className="text-xs font-medium text-primary">{open ? "Hide" : "Show"}</span>
        </button>
        {open && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.slots.map((sl) => (
              <div key={String(sl.slot)} className="overflow-hidden rounded-lg border">
                <div className="flex justify-between gap-2 border-b bg-muted/30 px-3 py-1.5 text-sm font-semibold">
                  <span>{slotLabel(sl.slot)}</span>
                  <span className="text-xs font-normal text-muted-foreground">+0 → +{sl.maxLevel}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {sl.mainStats.map((m) => (
                      <tr key={m.name} className="border-b last:border-0">
                        <td className="px-3 py-1 text-muted-foreground">{m.name}</td>
                        <td className="whitespace-nowrap px-3 py-1 text-right font-mono text-xs">
                          {m.base} → <span className="text-amber-400">{m.max}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sl.note && <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">{sl.note}</p>}
              </div>
            ))}
            <div className="overflow-hidden rounded-lg border">
              <div className="border-b bg-muted/30 px-3 py-1.5 text-sm font-semibold">
                Substats{hasValues ? " (per roll)" : ""}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {t.substats.map((m) => (
                    <tr key={m.name} className="border-b last:border-0">
                      <td className="px-3 py-1 text-muted-foreground">{m.name}</td>
                      {hasValues && <td className="px-3 py-1 text-right font-mono text-xs text-amber-400">{m.value}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {t.substatNote && <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">{t.substatNote}</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
