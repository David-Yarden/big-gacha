/**
 * Banner history of a game: what is live now, what is coming, then every past banner by
 * version, with its dates and featured characters / weapons. Data: community wikis and
 * datasets (credited at the top), refreshed by the sync.
 */
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ImageWithFallback, viaCache } from "@/components/shared/ImageWithFallback";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getBanners, type Banner, type BannerHistory, type BannerUnit } from "@/lib/api";
import { registryGame } from "@/lib/registry";
import { RARITY_COLOR_MAP } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { dateRange, statusOf, statusText, unitIcon, unitLink } from "@/lib/banners";
import { LANG } from "@/lib/i18n";
import { EventsSection } from "@/components/shared/EventsSection";
import type { Game } from "@/lib/types";

// Where each game's history comes from (shown as a credit)
const SOURCE_LINKS: Record<string, { label: string; url: string }> = {
  genshin: { label: "Genshin Impact Wiki (Fandom), CC BY-SA", url: "https://genshin-impact.fandom.com/wiki/Wish/History" },
  hsr: { label: "Honkai: Star Rail Wiki (Fandom), CC BY-SA", url: "https://honkai-star-rail.fandom.com/wiki/Warp/List" },
  zzz: { label: "Zenless Zone Zero Wiki (Fandom), CC BY-SA", url: "https://zenless-zone-zero.fandom.com/wiki/Exclusive_Channel/History" },
  wuwa: { label: "Wuthering Waves Wiki (Fandom), CC BY-SA", url: "https://wutheringwaves.fandom.com/wiki/Featured_Resonator_Convene" },
  endfield: { label: "Arknights: Endfield Wiki (wiki.gg), CC BY-SA", url: "https://endfield.wiki.gg/wiki/Headhunting/Banners" },
};

const KIND_LABELS: Record<string, string> = { character: "Characters", weapon: "Weapons", chronicled: "Chronicled" };
const KIND_ORDER = ["character", "weapon", "chronicled"];
const WEAPON_WORD: Record<string, string> = { hsr: "Light Cones", zzz: "W-Engines" };
const CHAR_WORD: Record<string, string> = { zzz: "Agents", wuwa: "Resonators", endfield: "Operators" };

function Unit({ game, unit, units, size }: { game: string; unit: BannerUnit; units: BannerHistory["units"]; size: "lg" | "sm" }) {
  const known = !!units[`${unit.kind}:${unit.name}`];
  const rarity = unit.rarity ?? units[`${unit.kind}:${unit.name}`]?.rarity ?? 0;
  const href = unitLink(game, unit, known);
  // French name when the site has the unit (units come translated from the API)
  const label = (units[`${unit.kind}:${unit.name}`] as { name?: string } | undefined)?.name ?? unit.name;
  const body = (
    <span className="group/unit flex flex-col items-center gap-1" title={label}>
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-lg ring-1 ring-white/10",
          `${RARITY_COLOR_MAP[rarity] ?? "bg-muted"}/25`,
          size === "lg" ? "h-16 w-16" : "h-10 w-10"
        )}
      >
        <ImageWithFallback
          src={unitIcon(game, unit, units)}
          alt={label}
          className={cn(
            "h-full w-full transition-transform group-hover/unit:scale-105",
            unit.kind === "character" && game === "endfield" ? "object-cover object-top" : "object-contain"
          )}
        />
      </span>
      <span className={cn("max-w-[4.5rem] truncate text-center leading-tight", size === "lg" ? "text-xs font-semibold" : "text-[10px] text-muted-foreground")}>
        {label}
      </span>
    </span>
  );
  return href ? (
    <Link to={href} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {body}
    </Link>
  ) : (
    body
  );
}

function BannerCard({ game, banner, units, now }: { game: string; banner: Banner; units: BannerHistory["units"]; now: number }) {
  const status = statusOf(banner, now);
  const top = Math.max(0, ...banner.featured.map((f) => f.rarity ?? 0));
  const main = banner.featured.filter((f) => f.rateUp !== false && (f.rarity ?? top) >= Math.min(top, 5));
  const minor = banner.featured.filter((f) => !main.includes(f));
  const image = banner.image ? viaCache(banner.image) ?? banner.image : null;
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card/60 sm:flex-row",
        status === "live" ? "border-emerald-500/40" : status === "upcoming" ? "border-sky-500/40" : "border-white/[0.08]"
      )}
    >
      {image && (
        // The whole 16:9 art, centred beside the text
        <div className="flex shrink-0 items-center bg-black/30 sm:w-72">
          <img src={image} alt="" loading="lazy" className="aspect-video w-full object-cover" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <h3 className="truncate font-semibold leading-tight">{banner.title ?? banner.name}</h3>
            <p className="text-xs text-muted-foreground">{dateRange(banner)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
            {banner.collab && <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-fuchsia-300">Collab</span>}
            {banner.kind && banner.kind !== "character" && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {banner.kind === "weapon" ? WEAPON_WORD[game] ?? "Weapons" : KIND_LABELS[banner.kind]}
              </span>
            )}
            {status !== "past" && (
              <span className={cn("rounded px-1.5 py-0.5", status === "live" ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300")}>
                {statusText(banner, now)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
          {main.map((u) => (
            <Unit key={`${u.kind}:${u.name}`} game={game} unit={u} units={units} size="lg" />
          ))}
          {minor.length > 0 && (
            <div className="flex flex-wrap items-end gap-2 border-l border-white/[0.08] pl-3">
              {minor.map((u) => (
                <Unit key={`${u.kind}:${u.name}`} game={game} unit={u} units={units} size="sm" />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="grid gap-3 xl:grid-cols-2">{children}</div>
    </section>
  );
}

export function BannersPage() {
  const { game = "genshin" } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error } = useApiQuery(() => getBanners(game as Game), [game]);
  const [now] = useState(() => Date.now());
  const history = data?.data;
  const kind = searchParams.get("kind") ?? "";
  const search = searchParams.get("search") ?? "";
  const reg = registryGame(game);

  const kinds = useMemo(
    () => [...new Set((history?.banners ?? []).map((b) => b.kind ?? "character"))].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b)),
    [history]
  );
  // Same dates: character banners before weapon banners
  const byKind = (a: Banner, b: Banner) => KIND_ORDER.indexOf(a.kind ?? "character") - KIND_ORDER.indexOf(b.kind ?? "character");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (history?.banners ?? []).filter(
      (b) =>
        (!kind || (b.kind ?? "character") === kind) &&
        (!q || (b.title ?? b.name).toLowerCase().includes(q) || b.featured.some((f) => [f.name, (history?.units?.[`${f.kind}:${f.name}`] as { name?: string } | undefined)?.name ?? ""].some((n) => n.toLowerCase().includes(q))))
    );
  }, [history, kind, search]);

  const live = filtered.filter((b) => statusOf(b, now) === "live").sort(byKind);
  const upcoming = filtered.filter((b) => statusOf(b, now) === "upcoming").reverse().sort(byKind);
  const byVersion = useMemo(() => {
    const groups = new Map<string, Banner[]>();
    for (const b of filtered) {
      if (statusOf(b, now) !== "past") continue;
      const v = b.version ?? "Other";
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v)!.push(b);
    }
    return [...groups];
  }, [filtered, now]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const credit = SOURCE_LINKS[game];
  const units = history?.units ?? {};

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Banners</h1>
        <p className="text-sm text-muted-foreground">
          {LANG === "fr"
            ? `Toutes les bannières limitées de ${reg?.shortName ?? ""}, avec leurs dates et leurs vedettes`
            : `Every limited ${reg?.shortName ?? ""} banner with its dates and featured ${CHAR_WORD[game]?.toLowerCase() ?? "characters"}`}
          {credit && (
            <>
              {LANG === "fr" ? " · Données : " : " · Data: "}
              <a href={credit.url} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-foreground">
                {credit.label}
              </a>
            </>
          )}
        </p>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search a banner or ${game === "endfield" ? "an operator" : "a character"}…`}
            value={search}
            onChange={(e) => setParam("search", e.target.value)}
            className="pl-9"
          />
        </div>
        {kinds.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Banner type">
            {["", ...kinds].map((k) => (
              <button
                key={k || "all"}
                type="button"
                onClick={() => setParam("kind", k)}
                aria-pressed={kind === k}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                  kind === k ? "border-primary bg-primary text-primary-foreground" : "border-white/[0.08] text-muted-foreground hover:text-foreground"
                )}
              >
                {k === "" ? "All" : k === "weapon" ? WEAPON_WORD[game] ?? "Weapons" : k === "character" ? CHAR_WORD[game] ?? "Characters" : KIND_LABELS[k] ?? k}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && !history && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      {history && !history.banners.length && (
        <p className="py-12 text-center text-sm text-muted-foreground">No banner yet: they arrive with the next sync.</p>
      )}
      {history && history.banners.length > 0 && !filtered.length && (
        <p className="py-12 text-center text-sm text-muted-foreground">No banner matches.</p>
      )}

      {live.length > 0 && (
        <Section title="Live now">
          {live.map((b) => (
            <BannerCard key={b.name} game={game} banner={b} units={units} now={now} />
          ))}
        </Section>
      )}
      {upcoming.length > 0 && (
        <Section title="Upcoming">
          {upcoming.map((b) => (
            <BannerCard key={b.name} game={game} banner={b} units={units} now={now} />
          ))}
        </Section>
      )}

      <EventsSection game={game} now={now} />
      {byVersion.map(([version, list]) => (
        <Section key={version} title={version === "Other" ? "Other" : `Version ${version}`}>
          {list.map((b) => (
            <BannerCard key={b.name} game={game} banner={b} units={units} now={now} />
          ))}
        </Section>
      ))}
    </div>
  );
}
