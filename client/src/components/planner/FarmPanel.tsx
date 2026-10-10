/**
 * "Where to farm" of the planner: the materials still missing, grouped by where they drop
 * (Genshin domain, HSR Calyx, WuWa boss…), the ones open today first. Genshin domains
 * only open on some weekdays (the game day starts at 04:00): their days are shown, today
 * highlighted, with the next opening day otherwise.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MaterialIcon } from "@/components/character/shared";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getFarmInfo, type FarmInfo } from "@/lib/api";
import { LOCALE } from "@/lib/i18n";
import type { MaterialCostEntry } from "@/lib/materials";
import type { Game } from "@/lib/types";

export interface MissingRow {
  mat: MaterialCostEntry;
  missing: number;
}

/** Today's weekday in the game (1 = Monday … 7 = Sunday); the day changes at 04:00. */
export function gameWeekday(now = new Date()): number {
  const d = new Date(now.getTime() - 4 * 3600 * 1000);
  return d.getDay() === 0 ? 7 : d.getDay();
}

/** Short name of a weekday (1 = Monday) in the site's language. */
function dayName(day: number, style: "short" | "long" = "short"): string {
  // 2024-01-01 was a Monday
  return new Date(2024, 0, day).toLocaleDateString(LOCALE, { weekday: style });
}

/** The next weekday (from today) in `days`. */
function nextDay(days: number[], today: number): number | undefined {
  for (let i = 1; i <= 7; i++) {
    const d = ((today - 1 + i) % 7) + 1;
    if (days.includes(d)) return d;
  }
  return undefined;
}

// Sources that do not point to a farming spot (shops, events, crafting, generic hints)
const NOT_A_SPOT = /^(random event|adventure and exploration|purchase|limited-duration event|check the enemies|exchanged? |exchange|craft|synthes|omni-synthesizer|go to collect|obtain(ed)? from|supply pack|dismantle|fading signal|acquisition center|.*shop|récompense d'(événement|aventure)|achat|achet|échang|fabrica|synthè|boutique|.*magasin)/i;

/** The farming spot of a material: its domain, else its first real source (enemy levels merged). */
function spotOf(m: FarmInfo | undefined): string {
  if (m?.domain) return m.domain;
  const src = (m?.source ?? []).find((s) => !NOT_A_SPOT.test(s.trim()));
  return src ? src.replace(/\bLv\.\s*\d+\+\s*/g, "").replace(/\s{2,}/g, " ").trim() : "";
}

const OTHER = "Other sources";

interface Group {
  where: string;
  days: number[];
  open: boolean;
  items: MissingRow[];
}

export function FarmPanel({ game, rows }: { game: Game; rows: MissingRow[] }) {
  const missing = rows.filter((r) => r.missing > 0);
  const key = missing.map((r) => r.mat.name).sort().join("|");
  const { data } = useApiQuery(() => (key ? getFarmInfo(game, key.split("|")) : Promise.resolve(null)), [game, key]);
  const today = gameWeekday();

  const groups = useMemo(() => {
    const info = new Map<string, FarmInfo>();
    for (const m of data?.data ?? []) info.set(m.name, m);
    const byWhere = new Map<string, Group>();
    for (const row of missing) {
      const m = info.get(row.mat.name);
      if (!m) continue;
      const where = spotOf(m) || OTHER;
      const days = m.days ?? [];
      if (!byWhere.has(where)) byWhere.set(where, { where, days, open: !days.length || days.includes(today), items: [] });
      byWhere.get(where)!.items.push(row);
    }
    // Weekday-limited domains open today, then the always-open spots, then closed domains
    const rank = (g: Group) => (g.where === OTHER ? 3 : g.days.length ? (g.open ? 0 : 2) : 1);
    return [...byWhere.values()].sort((a, b) => rank(a) - rank(b) || b.items.length - a.items.length);
  }, [data, missing, today]);

  if (!groups.length) return null;
  const hasDays = groups.some((g) => g.days.length);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Where to farm</h2>
          {hasDays && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>{`Today: ${dayName(today, "long")}`}</span>
            </span>
          )}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {groups.map((g) => {
            const next = g.open ? undefined : nextDay(g.days, today);
            return (
              <div
                key={g.where}
                className={`rounded-lg border p-3 space-y-2 ${g.days.length && g.open ? "border-emerald-500/40 bg-emerald-500/5" : ""} ${!g.open ? "opacity-60" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className={`text-sm leading-snug ${g.where === OTHER ? "text-muted-foreground" : "font-medium"}`}>{g.where}</span>
                  {g.days.length > 0 &&
                    (g.open ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        <Check className="h-3 w-3" />
                        Open today
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {next ? `Next: ${dayName(next, "long")}` : ""}
                      </span>
                    ))}
                </div>
                {g.days.length > 0 && g.days.length < 7 && (
                  <div className="flex flex-wrap gap-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <span
                        key={d}
                        className={`rounded px-1.5 py-0.5 text-[11px] capitalize ${
                          !g.days.includes(d)
                            ? "text-muted-foreground/40"
                            : d === today
                              ? "bg-emerald-500/20 font-semibold text-emerald-300"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {dayName(d).replace(".", "")}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map(({ mat, missing: n }) => (
                    <Link
                      key={mat.name}
                      to={`/${game}/materials/${encodeURIComponent(mat.name)}`}
                      title={mat.name}
                      className="flex items-center gap-1 rounded-md bg-muted/40 py-0.5 pl-0.5 pr-1.5 font-mono text-xs hover:bg-muted"
                    >
                      <MaterialIcon mat={mat} game={game} />
                      {n.toLocaleString(LOCALE)}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
