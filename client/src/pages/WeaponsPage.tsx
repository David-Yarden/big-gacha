import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { getWeapons } from "@/lib/api";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { weaponIconUrl } from "@/lib/images";
import {
  GENSHIN_WEAPON_TYPES,
  WEAPON_RARITIES,
  RARITY_COLOR_MAP,
} from "@/lib/constants";
import type { Game, Weapon } from "@/lib/types";
import type { FilterGroup, SortOption } from "@/components/shared/FilterBar";

const WEAPON_FILTERS: FilterGroup[] = [
  {
    key: "weaponType",
    label: "Type",
    options: GENSHIN_WEAPON_TYPES.map((wt) => ({ value: wt, label: wt })),
  },
  {
    key: "rarity",
    label: "Rarity",
    options: WEAPON_RARITIES.map((r) => ({
      value: String(r),
      label: "★".repeat(r),
    })),
  },
];

const SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "Name" },
  { value: "version", label: "Release" },
];

function WeaponCard({ weapon, game }: { weapon: Weapon; game: string }) {
  const rarityClass = RARITY_COLOR_MAP[weapon.rarity] ?? "bg-muted";

  return (
    <Link to={`/${game}/weapons/${weapon.name}`}>
      <Card className="group overflow-hidden transition-colors hover:border-primary/40">
        <div
          className={`relative flex h-32 items-center justify-center ${rarityClass}/20`}
        >
          <ImageWithFallback
            src={weaponIconUrl(weapon.images)}
            alt={weapon.name}
            className="h-full w-full object-contain p-2"
          />
        </div>
        <CardContent className="p-3">
          <p className="font-semibold text-sm truncate">{weapon.name}</p>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{weapon.weaponType}</span>
            <RarityStars rarity={weapon.rarity} className="text-xs" />
          </div>
          {weapon.baseAtkValue && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Base ATK: {weapon.baseAtkValue}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function buildSort(sortBy: string, sortDir: string): string {
  const desc = sortDir === "desc";
  if (sortBy === "version") return desc ? "-version,name" : "version,name";
  if (sortBy === "name") return desc ? "-name" : "name";
  return "-rarity,name";
}

export function WeaponsPage() {
  const { game } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? undefined;
  const weaponType = searchParams.get("weaponType") ?? undefined;
  const rarity = searchParams.get("rarity") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "";
  const sortDir = searchParams.get("sortDir") ?? "asc";

  const sort = buildSort(sortBy, sortDir);

  const { items, total, loading, error, hasMore, sentinelRef } = useInfiniteList(
    (page) =>
      getWeapons(game as Game, {
        page,
        limit: 25,
        search,
        weaponType,
        rarity: rarity ? Number(rarity) : undefined,
        sort,
      }),
    [game, search, weaponType, rarity, sort]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Weapons</h1>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">{total} total</span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search weapons..."
        filterGroups={WEAPON_FILTERS}
        sortOptions={SORT_OPTIONS}
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <ResourceGrid
        loading={loading && items.length === 0}
        empty={items.length === 0 && !loading}
        emptyMessage="No weapons found"
      >
        {items.map((w) => (
          <WeaponCard key={w._id} weapon={w} game={game!} />
        ))}
      </ResourceGrid>

      {loading && items.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <div ref={sentinelRef} className="h-px" />

      {!hasMore && items.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-2">
          All {total} weapons loaded
        </p>
      )}
    </div>
  );
}
