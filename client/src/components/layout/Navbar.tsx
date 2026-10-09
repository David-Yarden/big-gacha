import { useEffect, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GAMES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { linksFor, equivalentPath } from "@/lib/navigation";

export function Navbar() {
  const { game } = useParams<{ game: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentGame = GAMES.find((g) => g.id === game);
  const navLinks = linksFor(game);
  const currentResource = location.pathname.split("/")[2] ?? "";

  // Close the mobile menu on navigation
  useEffect(() => setMobileOpen(false), [location.pathname]);

  function switchGame(gameId: string) {
    navigate(`/${gameId}/${equivalentPath(game, currentResource, gameId)}`);
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-bold text-lg">
          <img src="/BIG_GACHA_LOGO.png" alt="" className="h-10 w-10 object-contain" />
          <span className="hidden sm:inline">Big Gacha</span>
        </Link>

        <div className="flex items-center gap-2 md:gap-4">
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
            <>
              <div className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Button
                    key={link.path}
                    asChild
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-muted-foreground hover:text-foreground",
                      currentResource === link.path && "text-foreground bg-accent"
                    )}
                  >
                    <Link to={`/${game}/${link.path}`}>{link.label}</Link>
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((o) => !o)}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </>
          )}
        </div>
      </div>

      {game && mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 px-4 py-2">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={`/${game}/${link.path}`}
              className={cn(
                "block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                currentResource === link.path && "bg-accent text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
