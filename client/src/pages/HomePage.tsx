import { Link } from "react-router-dom";
import { Gamepad2, Database, ArrowRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GAMES } from "@/lib/constants";
import { getStats } from "@/lib/api";
import { useApiQuery } from "@/hooks/useApiQuery";

export function HomePage() {
  const { data: stats, loading } = useApiQuery(
    () => getStats("genshin"),
    []
  );

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="flex flex-col items-center gap-4 pt-10 pb-4 text-center">
        <Gamepad2 className="h-12 w-12 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight">Big Gacha</h1>
        <p className="max-w-md text-muted-foreground">
          A multi-game gacha database. Browse characters, weapons, artifacts,
          and more across your favorite gacha games.
        </p>
      </section>

      {/* Game cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((game) => (
          <Card
            key={game.id}
            className={`relative overflow-hidden transition-colors ${
              game.available
                ? "hover:border-primary/50"
                : "opacity-50"
            }`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{game.name}</CardTitle>
                {game.available ? (
                  <Badge variant="default">Live</Badge>
                ) : (
                  <Badge variant="secondary">Coming Soon</Badge>
                )}
              </div>
              <CardDescription>{game.description}</CardDescription>
            </CardHeader>

            {game.id === "genshin" && (
              <CardContent>
                {loading ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 rounded-md" />
                    ))}
                  </div>
                ) : stats?.data ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(stats.data).map(([key, count]) => (
                      <div
                        key={key}
                        className="flex flex-col items-center rounded-md bg-secondary/50 p-2"
                      >
                        <span className="text-lg font-semibold">{count}</span>
                        <span className="text-xs capitalize text-muted-foreground">
                          {key}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            )}

            <CardFooter>
              {game.available ? (
                <Link to={`/${game.id}/characters`} className="w-full">
                  <Button className="w-full gap-2" variant="outline">
                    Browse
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button className="w-full" variant="outline" disabled>
                  Coming Soon
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </section>

      {/* API info */}
      <section className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground pb-8">
        <Database className="h-4 w-4" />
        <p>
          Powered by the Big Gacha REST API.{" "}
          <a
            href="/api"
            target="_blank"
            className="underline hover:text-foreground"
          >
            View API docs
          </a>
        </p>
      </section>
    </div>
  );
}
