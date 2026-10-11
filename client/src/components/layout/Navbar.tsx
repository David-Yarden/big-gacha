import { useEffect, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Menu, RefreshCw, X } from "lucide-react";
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
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { PowerButton } from "@/components/layout/PowerButton";
import { usePluginLinks } from "@/lib/plugins";
import { LANG, setLang } from "@/lib/i18n";

export function Navbar() {
  const { game } = useParams<{ game: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { status: sync } = useSyncStatus();
  const syncFailed = sync?.data.some((g) => g.lastStatus === "failed");

  const currentGame = GAMES.find((g) => g.id === game);
  const pluginLinks = usePluginLinks(game);
  const navLinks = [...linksFor(game), ...pluginLinks];
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
          <GlobalSearch />
          <Link
            to="/updates"
            className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={
              sync?.running
                ? `Sync in progress (${sync.running})`
                : syncFailed
                ? "Last sync failed — open Updates"
                : sync?.unseen
                ? "New data — open Updates"
                : "Updates"
            }
            aria-label="Updates"
          >
            <RefreshCw className={cn("h-4 w-4", sync?.running && "animate-spin")} />
            {(sync?.unseen || syncFailed) && (
              <span
                className={cn(
                  "absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-background",
                  syncFailed ? "bg-destructive" : "bg-amber-400"
                )}
              />
            )}
          </Link>
          <button
            type="button"
            onClick={() => setLang(LANG === "fr" ? "en" : "fr")}
            className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={LANG === "fr" ? "Switch to English" : "Passer en français"}
            aria-label={LANG === "fr" ? "Switch to English" : "Passer en français"}
            data-no-translate
          >
            {LANG === "fr" ? "EN" : "FR"}
          </button>
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

          <PowerButton />

          {game && (
            <>
              <div className="hidden lg:flex items-center gap-1">
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
                className="lg:hidden"
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
        <div className="lg:hidden border-t border-border bg-background/95 px-4 py-2">
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
