import { Link } from "react-router-dom";
import { Database, ArrowRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GAMES } from "@/lib/constants";

export function HomePage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="flex flex-col items-center gap-4 pt-10 pb-4 text-center">
        <img src="/BIG_GACHA_LOGO.png" alt="Big Gacha" className="h-32 w-32 object-contain" />
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
                <img
                  src="/Genshin_title.png"
                  alt="Genshin Impact"
                  className="w-full object-contain max-h-40"
                />
              </CardContent>
            )}

            {game.id === "hsr" && (
              <CardContent>
                <img
                  src="/HSR_title.png"
                  alt="Honkai: Star Rail"
                  className="w-full object-contain max-h-40"
                />
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
