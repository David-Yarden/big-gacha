import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/shared/FilterBar";
import { Pagination } from "@/components/shared/Pagination";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { getWeapons } from "@/lib/api";
import { useApiQuery } from "@/hooks/useApiQuery";
import { weaponIconUrl, weaponTypeIconUrl } from "@/lib/images";
import {
  GENSHIN_WEAPON_TYPES,
  WEAPON_RARITIES,
  RARITY_COLOR_MAP,
} from "@/lib/constants";
import type { Game, Weapon } from "@/lib/types";
import type { FilterGroup } from "@/components/shared/FilterBar";

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

function WeaponCard({ weapon, game }: { weapon: Weapon; game: string }) {
  const rarityClass = RARITY_COLOR_MAP[weapon.rarity] ?? "bg-muted";
  const typeIconUrl = weaponTypeIconUrl(weapon.weaponType);

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
          {typeIconUrl && (
            <img
              src={typeIconUrl}
              alt={weapon.weaponType}
              className="absolute top-2 right-2 h-5 w-5 object-contain opacity-80"
            />
          )}
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

export function WeaponsPage() {
  const { game } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? undefined;
  const weaponType = searchParams.get("weaponType") ?? undefined;
  const rarity = searchParams.get("rarity") ?? undefined;

  const { data, loading, error } = useApiQuery(
    () =>
      getWeapons(game as Game, {
        page,
        limit: 20,
        search,
        weaponType,
        rarity: rarity ? Number(rarity) : undefined,
        sort: "-rarity,name",
      }),
    [game, page, search, weaponType, rarity]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Weapons</h1>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total} total
          </span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search weapons..."
        filterGroups={WEAPON_FILTERS}
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <ResourceGrid
        loading={loading}
        empty={(data?.data.length ?? 0) === 0 && !loading}
        emptyMessage="No weapons found"
      >
        {data?.data.map((w) => (
          <WeaponCard key={w._id} weapon={w} game={game!} />
        ))}
      </ResourceGrid>

      {data && (
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          searchParams={searchParams}
          setSearchParams={setSearchParams}
        />
      )}
    </div>
  );
}
