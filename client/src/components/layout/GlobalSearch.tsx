/**
 * Search every game at once (button in the navbar, or Ctrl/⌘ + K, or "/").
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { searchAll, type SearchResult } from "@/lib/api";
import { GAMES } from "@/lib/constants";
import { gameUi } from "@/lib/gameUi";
import {
  weaponIconUrl,
  wuwaWeaponIconUrl,
  artifactIconUrl,
  relicIconUrl,
  lightConePreviewUrl,
  wuwaEchoIconUrl,
  wuwaEchoSetIconUrl,
  materialIconUrl,
} from "@/lib/images";
import { cn } from "@/lib/utils";

function iconFor(r: SearchResult): string | null {
  const images = r.images;
  switch (r.type) {
    case "characters":
      return gameUi(r.game).portrait(images);
    case "weapons":
      return r.game === "wuwa" ? wuwaWeaponIconUrl(images) : weaponIconUrl(images);
    case "artifacts":
      return artifactIconUrl(images);
    case "relics":
      return relicIconUrl(images);
    case "lightcones":
      return lightConePreviewUrl(images);
    case "echoes":
      return wuwaEchoIconUrl(images);
    case "echosets":
      return wuwaEchoSetIconUrl(images);
    case "materials":
      return r.game === "genshin" ? materialIconUrl(images) : images?.icon ?? null;
    default:
      return images?.icon ?? null;
  }
}

const gameName = (id: string) => GAMES.find((g) => g.id === id)?.shortName ?? id;

export function GlobalSearch() {
  const [open, setOpen] = useState(false);

  // Ctrl/⌘ + K anywhere, or "/" when not typing in a field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "");
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:min-w-44"
        aria-label="Search all games"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search…</span>
        <kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] md:inline">Ctrl K</kbd>
      </button>
      {open && createPortal(<SearchDialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => inputRef.current?.focus(), []);

  // Debounced search; a stale answer never replaces a newer one
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      searchAll(q)
        .then((r) => {
          if (cancelled) return;
          setResults(r.data);
          setActive(0);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const go = (r: SearchResult) => {
    navigate(`/${r.game}/${r.type}/${encodeURIComponent(r.name)}`);
    onClose();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[active]) go(results[active]);
  };

  const listId = "global-search-results";
  const hint = useMemo(() => {
    if (query.trim().length < 2) return "Type at least 2 letters — characters, weapons, sets, echoes, materials…";
    if (loading && !results.length) return "Searching…";
    if (!results.length) return "No result";
    return null;
  }, [query, loading, results.length]);

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search all games"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-popover shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search all games…"
            className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results[active] ? `gs-${active}` : undefined}
          />
          <button type="button" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {hint ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">{hint}</p>
        ) : (
          <ul id={listId} role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
            {results.map((r, i) => (
              <li
                key={`${r.game}-${r.type}-${r.name}`}
                id={`gs-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2",
                  i === active ? "bg-accent" : "hover:bg-accent/60"
                )}
              >
                <ImageWithFallback src={iconFor(r)} alt="" className="h-10 w-10 shrink-0 rounded-md bg-muted/40 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.label}
                    {r.element ? ` · ${r.element}` : r.path ? ` · ${r.path}` : r.weaponType ? ` · ${r.weaponType}` : ""}
                    {r.rarity ? ` · ${"★".repeat(r.rarity)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{gameName(r.game)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
