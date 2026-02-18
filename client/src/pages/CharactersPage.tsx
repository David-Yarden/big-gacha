import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/FilterBar";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { getCharacters } from "@/lib/api";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { characterIconUrl } from "@/lib/images";
import {
  GENSHIN_ELEMENTS,
  GENSHIN_WEAPON_TYPES,
  CHARACTER_RARITIES,
  ELEMENT_COLOR_MAP,
  RARITY_COLOR_MAP,
} from "@/lib/constants";
import type { Game, Character } from "@/lib/types";
import type { FilterGroup, SortOption } from "@/components/shared/FilterBar";

const CHARACTER_FILTERS: FilterGroup[] = [
  {
    key: "element",
    label: "Element",
    options: GENSHIN_ELEMENTS.map((el) => ({ value: el, label: el })),
  },
  {
    key: "weaponType",
    label: "Weapon",
    options: GENSHIN_WEAPON_TYPES.map((wt) => ({ value: wt, label: wt })),
  },
  {
    key: "rarity",
    label: "Rarity",
    options: CHARACTER_RARITIES.map((r) => ({
      value: String(r),
      label: "★".repeat(r),
    })),
  },
];

const SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "Name" },
  { value: "version", label: "Release" },
];

function CharacterCard({ character, game }: { character: Character; game: string }) {
  const elementClass = ELEMENT_COLOR_MAP[character.element ?? ""] ?? "bg-muted";
  const rarityClass = RARITY_COLOR_MAP[character.rarity] ?? "bg-muted";

  return (
    <Link to={`/${game}/characters/${character.name}`}>
      <Card className="group overflow-hidden transition-colors hover:border-primary/40">
        <div
          className={`relative flex h-32 items-center justify-center ${rarityClass}/20`}
        >
          <ImageWithFallback
            src={characterIconUrl(character.images)}
            alt={character.name}
            className="h-full w-full object-contain"
          />
          <Badge
            className={`absolute top-2 right-2 ${elementClass} border-0 text-white text-xs`}
          >
            {character.element}
          </Badge>
        </div>
        <CardContent className="p-3">
          <p className="font-semibold text-sm truncate">{character.name}</p>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{character.weaponType}</span>
            <RarityStars rarity={character.rarity} className="text-xs" />
          </div>
          {character.region && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {character.region}
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

export function CharactersPage() {
  const { game } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? undefined;
  const element = searchParams.get("element") ?? undefined;
  const weaponType = searchParams.get("weaponType") ?? undefined;
  const rarity = searchParams.get("rarity") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "version";
  const sortDir = searchParams.get("sortDir") ?? "desc";

  const sort = buildSort(sortBy, sortDir);

  const { items, total, loading, error, hasMore, sentinelRef } = useInfiniteList(
    (page) =>
      getCharacters(game as Game, {
        page,
        limit: 25,
        search,
        element,
        weaponType,
        rarity: rarity ? Number(rarity) : undefined,
        sort,
      }),
    [game, search, element, weaponType, rarity, sort]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Characters</h1>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">{total} total</span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search characters..."
        filterGroups={CHARACTER_FILTERS}
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
        emptyMessage="No characters found"
      >
        {items.map((c) => (
          <CharacterCard key={c._id} character={c} game={game!} />
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
          All {total} characters loaded
        </p>
      )}
    </div>
  );
}
