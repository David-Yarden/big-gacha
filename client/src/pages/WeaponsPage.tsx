import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars, rarityLabel, rankIcon } from "@/components/shared/RarityStars";
import { gameUi } from "@/lib/gameUi";
import { getWeapons } from "@/lib/api";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { weaponIconUrl, wuwaWeaponIconUrl } from "@/lib/images";
import { formatBaseAtk, formatSpecialized } from "@/lib/formatters";
import { WEAPON_RARITIES, RARITY_COLOR_MAP } from "@/lib/constants";
import { registryGame, resourceLabel } from "@/lib/registry";
import type { Game, Weapon } from "@/lib/types";
import type { FilterGroup, SortOption } from "@/components/shared/FilterBar";

const SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "Name" },
  { value: "version", label: "Release" },
];

/** ATK at the highest level the weapon has stats for (what players compare), not level 1. */
function maxLevelAtk(weapon: Weapon): { level: number; atk: number; specialized?: number } | null {
  const stats = (weapon as { stats?: Record<string, { atk?: number; specialized?: number }> }).stats;
  if (!stats) return null;
  const level = Math.max(...Object.keys(stats).map(Number).filter((n) => stats[n]?.atk != null));
  return Number.isFinite(level) ? { level, atk: stats[level].atk as number, specialized: stats[level].specialized } : null;
}

function WeaponCard({ weapon, game }: { weapon: Weapon; game: string }) {
  const rarityClass = RARITY_COLOR_MAP[weapon.rarity] ?? "bg-muted";
  const iconUrl = game === "wuwa" ? wuwaWeaponIconUrl(weapon.images) : weaponIconUrl(weapon.images);
  const maxAtk = maxLevelAtk(weapon);

  return (
    <Link to={`/${game}/weapons/${encodeURIComponent(weapon.name)}`}>
      <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-primary/40">
        <div
          className={`relative flex items-center justify-center ${game === "zzz" ? "aspect-square" : "h-40"} ${rarityClass}/20`}
        >
          <ImageWithFallback
            src={iconUrl}
            alt={weapon.name}
            className="h-full w-full object-contain p-3"
          />
        </div>
        <CardContent className="p-3">
          <p className="font-semibold text-sm truncate">{weapon.name}</p>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{weapon.weaponType}</span>
            <RarityStars rarity={weapon.rarity} className="text-xs" />
          </div>
          {maxAtk ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              ATK Lv. {maxAtk.level}: {formatBaseAtk(maxAtk.atk)}
            </p>
          ) : weapon.baseAtkValue ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Base ATK: {formatBaseAtk(weapon.baseAtkValue)}</p>
          ) : null}
          {maxAtk?.specialized != null && weapon.mainStatText ? (
            <p className="text-xs text-muted-foreground truncate">
              {weapon.mainStatText}: {formatSpecialized(maxAtk.specialized, weapon.mainStatType)}
            </p>
          ) : null}
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
  const sortBy = searchParams.get("sortBy") ?? "version";
  const sortDir = searchParams.get("sortDir") ?? "desc";

  const sort = buildSort(sortBy, sortDir);

  // ZZZ W-Engines are typed by agent specialty
  const reg = registryGame(game);
  const weaponTypeOptions = (reg?.weaponTypes ?? reg?.specialties ?? []).map((wt) => ({
    value: wt,
    label: wt,
    icon: gameUi(game).weaponTypeIcon?.(wt) ?? undefined,
  }));

  const filterGroups: FilterGroup[] = [
    { key: "weaponType", label: "Type", options: weaponTypeOptions },
    {
      key: "rarity",
      label: "Rarity",
      options: (game === "zzz" ? [5, 4, 3] : game === "endfield" ? [6, 5, 4, 3] : WEAPON_RARITIES).map((r) => ({ value: String(r), label: rarityLabel(game, r), icon: rankIcon(game, r) })),
    },
  ];

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
        <h1 className="text-2xl font-bold">{resourceLabel(game, "weapons", "Weapons")}</h1>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">{`${total} total`}</span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search weapons..."
        filterGroups={filterGroups}
        sortOptions={SORT_OPTIONS}
        defaultSortBy="version"
        defaultSortDir="desc"
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
        columns={game === "zzz" ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8" : undefined}
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
          {`All ${total} weapons loaded`}
        </p>
      )}
    </div>
  );
}
