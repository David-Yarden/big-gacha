import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GAMES } from "@/lib/constants";
import { linksFor } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function HomePage() {
  const live = GAMES.filter((g) => g.available);
  const upcoming = GAMES.filter((g) => !g.available);

  return (
    <div className="space-y-10 pb-10">
      {/* Hero */}
      <section className="flex flex-col items-center gap-3 pt-8 text-center">
        <img src="/BIG_GACHA_LOGO.png" alt="" className="h-24 w-24 object-contain" />
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Big Gacha</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Characters, weapons, gear and materials of your gacha games, in one place.
        </p>
      </section>

      {/* Live games */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {live.map((game) => (
          <div
            key={game.id}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/50"
          >
            <Link
              to={`/${game.id}/characters`}
              className="flex flex-1 flex-col"
              aria-label={`Browse ${game.name}`}
            >
              <div className="flex h-40 items-center justify-center bg-gradient-to-b from-muted/40 to-transparent px-6">
                <img
                  src={game.logo}
                  alt={game.name}
                  className={cn(
                    "max-h-28 w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]",
                    game.logoClassName
                  )}
                />
              </div>
              <div className="flex items-center justify-between px-4 pt-3">
                <h2 className="font-semibold">{game.name}</h2>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
              <p className="px-4 text-xs text-muted-foreground">{game.description}</p>
            </Link>
            <div className="flex flex-wrap gap-1.5 p-4 pt-3">
              {linksFor(game.id).map((link) => (
                <Link
                  key={link.path}
                  to={`/${game.id}/${link.path}`}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Upcoming games */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Coming later</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((game) => (
              <div
                key={game.id}
                className="flex items-center gap-4 rounded-xl border border-dashed border-border p-3 opacity-70"
              >
                <img
                  src={game.logo}
                  alt=""
                  className={cn("h-10 w-24 object-contain grayscale", game.logoClassName)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{game.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{game.description}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">Soon</Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-xs text-muted-foreground">
        <a href="/api" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
          API
        </a>
      </p>
    </div>
  );
}
