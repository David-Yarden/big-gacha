import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface FilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface FilterBarProps {
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams) => void;
  searchPlaceholder?: string;
  filterGroups: FilterGroup[];
}

export function FilterBar({
  searchParams,
  setSearchParams,
  searchPlaceholder = "Search...",
  filterGroups,
}: FilterBarProps) {
  const search = searchParams.get("search") ?? "";

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
              {opt.label}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
