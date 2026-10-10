/**
 * Current and upcoming in-game events (official announcements of HoYoverse games), shown
 * on the Banners page. Read live through /api/:game/events (cached by the server).
 */
import { useState } from "react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getEvents, type GameEvent } from "@/lib/api";
import { formatDate, timeUntil } from "@/lib/banners";
import type { Game } from "@/lib/types";

export const EVENT_GAMES = new Set(["genshin", "hsr", "zzz"]);
const SHOWN = 6;

export function EventsSection({ game, now }: { game: Game; now: number }) {
  const { data } = useApiQuery(() => (EVENT_GAMES.has(game) ? getEvents(game) : Promise.resolve(null)), [game]);
  const [all, setAll] = useState(false);
  const events = (data?.data?.events ?? []).filter((e) => Date.parse(e.end) > now);
  if (!events.length) return null;
  // Live first (ending soonest), then upcoming (starting soonest)
  const live = events.filter((e) => Date.parse(e.start) <= now);
  const upcoming = events.filter((e) => Date.parse(e.start) > now).sort((a, b) => a.start.localeCompare(b.start));
  const list = [...live, ...upcoming];
  const shown = all ? list : list.slice(0, SHOWN);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Events</h2>
        <span className="text-xs text-muted-foreground">Data: official in-game announcements</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {shown.map((e) => (
          <EventCard key={e.id} event={e} now={now} />
        ))}
      </div>
      {list.length > SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} className="text-sm text-primary hover:underline">
          {all ? "Show less" : `Show all ${list.length} events`}
        </button>
      )}
    </section>
  );
}

function EventCard({ event: e, now }: { event: GameEvent; now: number }) {
  const started = Date.parse(e.start) <= now;
  const endsSoon = started && Date.parse(e.end) - now < 3 * 86_400_000;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {e.image && (
        // The games use different shapes (Genshin 1080×390, ZZZ thin strips): natural ratio
        <div className="w-full bg-muted/30">
          <ImageWithFallback src={e.image} alt="" className="block max-h-40 w-full object-cover" />
        </div>
      )}
      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug" title={e.title}>
          {e.title}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              !started ? "bg-sky-500/15 text-sky-300" : endsSoon ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-400"
            }`}
          >
            {started ? `Ends in ${timeUntil(e.end, now)}` : `Starts in ${timeUntil(e.start, now)}`}
          </span>
          <span className="text-muted-foreground">
            {formatDate(e.start)} – {formatDate(e.end)}
          </span>
        </div>
      </div>
    </div>
  );
}
