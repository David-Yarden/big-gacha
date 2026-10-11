import { Search, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { viaCache } from "@/components/shared/ImageWithFallback";
import { TrimmedImage } from "@/components/shared/TrimmedImage";

/** "New Federation" → "NF", "Ashinohara" → "A", "Others" → "?" (option without an emblem) */
function monogram(label: string): string {
  if (/^others?$/i.test(label)) return "?";
  const words = label.replace(/^the\s+/i, "").split(/[\s-]+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(of|and|the)$/i.test(w));
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || label.slice(0, 1);
}

export interface FilterGroup {
  key: string;
  label: string;
  /** iconClass: coloured disc behind a white glyph icon; labelClass: label colour (e.g. rarity stars) */
  options: { value: string; label: string; icon?: string; iconClass?: string; labelClass?: string }[];
  /** Show the icons alone (name on hover) — for long lists of emblems */
  iconOnly?: boolean;
}

export interface SortOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams) => void;
  searchPlaceholder?: string;
  filterGroups: FilterGroup[];
  sortOptions?: SortOption[];
  defaultSortBy?: string;
  defaultSortDir?: string;
}

export function FilterBar({
  searchParams,
  setSearchParams,
  searchPlaceholder = "Search...",
  filterGroups,
  sortOptions,
  defaultSortBy = "",
  defaultSortDir = "asc",
}: FilterBarProps) {
  const search = searchParams.get("search") ?? "";
  const sortBy = searchParams.get("sortBy") ?? defaultSortBy;
  const sortDir = searchParams.get("sortDir") ?? defaultSortDir;

  function toggleFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (next.get(key) === value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.delete("page");
    setSearchParams(next);
  }

  function setSearch(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set("search", value);
    } else {
      next.delete("search");
    }
    next.delete("page");
    setSearchParams(next);
  }

  function toggleSort(value: string) {
    const next = new URLSearchParams(searchParams);
    if (sortBy === value) {
      // Toggle direction
      next.set("sortDir", sortDir === "asc" ? "desc" : "asc");
    } else {
      next.set("sortBy", value);
      next.set("sortDir", "asc");
    }
    next.delete("page");
    setSearchParams(next);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filterGroups.map((group) => (
        <div key={group.key} className="flex flex-wrap gap-1.5">
          {group.options.map((opt) => (
            group.iconOnly ? (
              // Emblem chip; the name shows on hover / keyboard focus. Without an emblem: a monogram.
              <span key={opt.value} className="group/chip relative inline-flex">
                <Button
                  variant={searchParams.get(group.key) === opt.value ? "default" : "outline"}
                  size="sm"
                  className="h-9 w-9 p-1"
                  aria-label={opt.label}
                  onClick={() => toggleFilter(group.key, opt.value)}
                >
                  {opt.icon ? (
                    <img src={viaCache(opt.icon) ?? opt.icon} className="h-full w-full object-contain" alt="" />
                  ) : (
                    <span className="text-[11px] font-bold leading-none tracking-tight">{monogram(opt.label)}</span>
                  )}
                </Button>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 w-max max-w-[16rem] text-center rounded-md border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground hidden shadow-md group-hover/chip:block group-focus-within/chip:block"
                >
                  {opt.label}
                </span>
              </span>
            ) : (
              <Button
                key={opt.value}
                variant={
                  searchParams.get(group.key) === opt.value ? "default" : "outline"
                }
                size="sm"
                className="h-7 text-xs"
                onClick={() => toggleFilter(group.key, opt.value)}
              >
                {opt.icon && (opt.iconClass ? (
                  <span className={`-ml-1 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full ${opt.iconClass}`}>
                    {/* Trimmed: the game's glyphs sit off-centre in their PNG */}
                    <TrimmedImage src={opt.icon} alt="" maxWidth={11} maxHeight={11} />
                  </span>
                ) : /_class_icon/.test(opt.icon) ? (
                  // CZN class icons: a small glyph in a wide transparent margin, trimmed to show
                  <span className="-ml-0.5 inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center">
                    <TrimmedImage src={opt.icon} alt="" maxWidth={18} maxHeight={18} />
                  </span>
                ) : (
                  <img src={viaCache(opt.icon) ?? opt.icon} className="h-3.5 w-3.5 shrink-0" alt="" />
                ))}
                <span className={opt.labelClass}>{opt.label}</span>
              </Button>
            )
          ))}
        </div>
      ))}

      {sortOptions && sortOptions.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Sort:</span>
          {sortOptions.map((opt) => {
            const isActive = sortBy === opt.value;
            return (
              <Button
                key={opt.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => toggleSort(opt.value)}
              >
                {opt.label}
                {isActive && (
                  sortDir === "asc"
                    ? <ArrowUp className="h-3 w-3" />
                    : <ArrowDown className="h-3 w-3" />
                )}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
