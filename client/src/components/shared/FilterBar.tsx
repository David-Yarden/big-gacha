import { Search, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface FilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string; icon?: string }[];
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
            <Button
              key={opt.value}
              variant={
                searchParams.get(group.key) === opt.value ? "default" : "outline"
              }
              size="sm"
              className="h-7 text-xs"
              onClick={() => toggleFilter(group.key, opt.value)}
            >
              {opt.icon && <img src={opt.icon} className="h-3.5 w-3.5 shrink-0" alt="" />}
              {opt.label}
            </Button>
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
