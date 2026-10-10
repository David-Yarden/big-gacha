/**
 * "Banners" section of a character / weapon page: every limited banner that featured it,
 * with a summary (first run, number of runs, live now or time since the last one).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { viaCache } from "@/components/shared/ImageWithFallback";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getBanners, type Banner, type BannerHistory } from "@/lib/api";
import { dateRange, formatDate, statusOf, statusText, timeSince } from "@/lib/banners";
import { cn } from "@/lib/utils";
import { LANG } from "@/lib/i18n";
import type { Game } from "@/lib/types";

interface UnitBannersProps {
  game: string;
  name: string;
  kind: "character" | "weapon";
  /** Inside a tab (no outer card title) */
  bare?: boolean;
}

const FR = LANG === "fr";

/** Displayed name of a featured unit (its French name when the site has it) */
const shownName = (units: BannerHistory["units"], f: { name: string; kind: string }) =>
  (units[`${f.kind}:${f.name}`] as { name?: string } | undefined)?.name ?? f.name;

function Row({ banner, unitName, now, units }: { banner: Banner; unitName: string; now: number; units: BannerHistory["units"] }) {
  const status = statusOf(banner, now);
  const me = banner.featured.find((f) => f.name === unitName);
  const others = banner.featured.filter((f) => f.name !== unitName && (f.rarity ?? 0) >= (me?.rarity ?? 5));
  const image = banner.image ? viaCache(banner.image) ?? banner.image : null;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-2",
        status === "live" ? "border-emerald-500/40" : status === "upcoming" ? "border-sky-500/40" : "border-white/[0.06]"
      )}
    >
      <div className="w-24 shrink-0 overflow-hidden rounded-md bg-black/30 sm:w-32">
        {image ? (
          <img src={image} alt="" loading="lazy" className="aspect-video w-full object-cover" />
        ) : (
          <div className="flex aspect-video items-center justify-center text-[10px] text-muted-foreground">{banner.version ?? ""}</div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-semibold">{banner.title ?? banner.name}</span>
          {banner.version && <span className="text-[10px] text-muted-foreground">v{banner.version}</span>}
        </div>
        <p className="text-xs text-muted-foreground">{dateRange(banner)}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
          {status !== "past" && (
            <span className={cn("rounded px-1.5 py-0.5", status === "live" ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300")}>
              {statusText(banner, now)}
            </span>
          )}
          {me && me.rateUp === false && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">In the pool</span>}
          {me && (me.rarity ?? 0) < Math.max(...banner.featured.map((f) => f.rarity ?? 0)) && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">Featured 4★</span>
          )}
          {banner.collab && <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-fuchsia-300">Collab</span>}
        </div>
        {others.length > 0 && (
          <p className="truncate text-[11px] text-muted-foreground">
            {FR ? "Avec" : "With"} {others.map((o) => shownName(units, o)).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

export function UnitBanners({ game, name, kind, bare }: UnitBannersProps) {
  const { data, loading } = useApiQuery(() => getBanners(game as Game, { name, kind }), [game, name, kind]);
  const [now] = useState(() => Date.now());
  const [all, setAll] = useState(false);
  const banners = data?.data?.banners ?? [];
  if (loading && !data) return bare ? <p className="text-sm text-muted-foreground">Loading…</p> : null;
  if (!banners.length) {
    return bare ? <p className="text-sm text-muted-foreground">Never featured on a limited banner (standard pool, event or free).</p> : null;
  }

  // As the star of the banner (not as a featured 4★ / pool unit)
  const top = (b: Banner) => {
    const me = b.featured.find((f) => f.name === name);
    return !!me && me.rateUp !== false && (me.rarity ?? 0) >= Math.max(...b.featured.map((f) => f.rarity ?? 0));
  };
  const chrono = [...banners].sort((a, b) => Date.parse(a.start ?? "") - Date.parse(b.start ?? ""));
  // Double banners (same unit, same dates on two banners) count as one run
  const runs = [...new Set(chrono.map((b) => (b.start ?? "").slice(0, 10)))];
  const first = chrono[0];
  const live = chrono.filter((b) => statusOf(b, now) === "live");
  const upcoming = chrono.filter((b) => statusOf(b, now) === "upcoming");
  const pastEnds = chrono.filter((b) => statusOf(b, now) === "past" && b.end).map((b) => b.end!);
  const lastEnd = pastEnds.sort().at(-1);
  const asStar = chrono.filter(top).length;

  const summary = (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded-md bg-muted/50 px-2 py-1">
        <span className="text-muted-foreground">First banner </span>
        <span className="font-semibold">{formatDate(first.start)}</span>
        {first.version && <span className="text-muted-foreground"> (v{first.version})</span>}
      </span>
      <span className="rounded-md bg-muted/50 px-2 py-1">
        <span className="font-semibold">{runs.length}</span>
        <span className="text-muted-foreground">
          {FR ? ` passage${runs.length > 1 ? "s" : ""}` : ` run${runs.length > 1 ? "s" : ""}`}
        </span>
        {asStar > 0 && asStar < banners.length && (
          <span className="text-muted-foreground">{FR ? ` · ${asStar} en vedette principale` : ` · ${asStar} as the featured star`}</span>
        )}
      </span>
      {live.length > 0 ? (
        <span className="rounded-md bg-emerald-500/15 px-2 py-1 font-semibold text-emerald-300">On a banner now</span>
      ) : upcoming.length > 0 ? (
        <span className="rounded-md bg-sky-500/15 px-2 py-1 font-semibold text-sky-300">
          {FR
            ? `De retour ${upcoming[0].start ? `le ${formatDate(upcoming[0].start)}` : "bientôt"}`
            : `Coming back ${upcoming[0].start ? `on ${formatDate(upcoming[0].start)}` : "soon"}`}
        </span>
      ) : lastEnd ? (
        <span className="rounded-md bg-muted/50 px-2 py-1">
          <span className="text-muted-foreground">Last banner ended </span>
          <span className="font-semibold">{FR ? timeSince(lastEnd, now) : `${timeSince(lastEnd, now)} ago`}</span>
        </span>
      ) : null}
    </div>
  );

  const newestFirst = [...chrono].reverse();
  const shown = all ? newestFirst : newestFirst.slice(0, 6);
  const list = (
    <div className="space-y-2">
      {summary}
      <div className="grid gap-2 lg:grid-cols-2">
        {shown.map((b) => (
          <Row key={b.name} banner={b} unitName={name} now={now} units={data?.data?.units ?? {}} />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        {newestFirst.length > 6 ? (
          <button type="button" onClick={() => setAll((v) => !v)} className="font-medium text-primary hover:underline">
            {all ? "Show fewer" : `Show all ${newestFirst.length} banners`}
          </button>
        ) : (
          <span />
        )}
        <Link to={`/${game}/banners`} className="text-muted-foreground hover:text-foreground">
          All banners →
        </Link>
      </div>
    </div>
  );

  if (bare) return list;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="font-semibold">Banners</h3>
        {list}
      </CardContent>
    </Card>
  );
}
