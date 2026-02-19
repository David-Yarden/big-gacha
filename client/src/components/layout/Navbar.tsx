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

const NAV_LINKS = [
  { label: "Characters", path: "characters" },
  { label: "Weapons", path: "weapons" },
  { label: "Artifacts", path: "artifacts" },
  { label: "Materials", path: "materials" },
];

export function Navbar() {
  const { game } = useParams<{ game: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const currentGame = GAMES.find((g) => g.id === game);

  // Determine which resource type is active from the current path
  const currentResource = location.pathname.split("/")[2] ?? "";

  function switchGame(gameId: string) {
    // Preserve current resource type when switching games
    const resource = currentResource || "characters";
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
              {NAV_LINKS.map((link) => (
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
