import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GAMES } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Per-game nav links
const GAME_NAV_LINKS: Record<string, Array<{ label: string; path: string }>> = {
  genshin: [
    { label: "Characters", path: "characters" },
    { label: "Weapons",    path: "weapons" },
    { label: "Artifacts",  path: "artifacts" },
    { label: "Materials",  path: "materials" },
  ],
  hsr: [
    { label: "Characters", path: "characters" },
    { label: "Light Cones",path: "lightcones" },
    { label: "Relics",     path: "relics" },
    { label: "Materials",  path: "materials" },
  ],
};

const DEFAULT_NAV_LINKS = [
  { label: "Characters", path: "characters" },
  { label: "Materials",  path: "materials" },
];

// When switching games, map resource types that have different names
const RESOURCE_EQUIVALENTS: Record<string, Record<string, string>> = {
  // coming from genshin → switching to hsr
  genshin: { weapons: "lightcones", artifacts: "relics" },
  // coming from hsr → switching to genshin
  hsr:     { lightcones: "weapons", relics: "artifacts" },
};

export function Navbar() {
  const { game } = useParams<{ game: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const currentGame = GAMES.find((g) => g.id === game);
  const navLinks = (game && GAME_NAV_LINKS[game]) ?? DEFAULT_NAV_LINKS;

  // Determine which resource type is active from the current path
  const currentResource = location.pathname.split("/")[2] ?? "";

  function switchGame(gameId: string) {
    // Preserve current resource type when switching games,
    // mapping equivalent resources when they have different names
    const equivalents = game ? (RESOURCE_EQUIVALENTS[game] ?? {}) : {};
    const resource = (equivalents[currentResource] ?? currentResource) || "characters";
    navigate(`/${gameId}/${resource}`);
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <img src="/BIG_GACHA_LOGO.png" alt="Big Gacha" className="h-10 w-10 object-contain" />
          <span>Big Gacha</span>
        </Link>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                {currentGame?.shortName ?? "Select Game"}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {GAMES.map((g) => (
                <DropdownMenuItem
                  key={g.id}
                  disabled={!g.available}
                  onSelect={() => switchGame(g.id)}
                >
                  {g.name}
                  {!g.available && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      Soon
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {game && (
            <div className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link key={link.path} to={`/${game}/${link.path}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-muted-foreground hover:text-foreground",
                      currentResource === link.path &&
                        "text-foreground bg-accent"
                    )}
                  >
                    {link.label}
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
