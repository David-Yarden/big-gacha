import { Link, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/FilterBar";
import { Pagination } from "@/components/shared/Pagination";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { getCharacters } from "@/lib/api";
import { useApiQuery } from "@/hooks/useApiQuery";
import { characterIconUrl, elementIconUrl } from "@/lib/images";
import {
  GENSHIN_ELEMENTS,
  GENSHIN_WEAPON_TYPES,
  CHARACTER_RARITIES,
  ELEMENT_COLOR_MAP,
  RARITY_COLOR_MAP,
} from "@/lib/constants";
import type { Game, Character } from "@/lib/types";
import type { FilterGroup } from "@/components/shared/FilterBar";

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

function CharacterCard({ character, game }: { character: Character; game: string }) {
  const elementClass = ELEMENT_COLOR_MAP[character.element ?? ""] ?? "bg-muted";
  const rarityClass = RARITY_COLOR_MAP[character.rarity] ?? "bg-muted";
  const elIconUrl = elementIconUrl(character.element);

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
            className={`absolute top-2 right-2 ${elementClass} border-0 text-white text-xs flex items-center gap-1`}
          >
            {elIconUrl && (
              <img src={elIconUrl} alt={character.element} className="h-3 w-3 invert" />
            )}
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

export function CharactersPage() {
  const { game } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? undefined;
  const element = searchParams.get("element") ?? undefined;
  const weaponType = searchParams.get("weaponType") ?? undefined;
  const rarity = searchParams.get("rarity") ?? undefined;

  const { data, loading, error } = useApiQuery(
    () =>
      getCharacters(game as Game, {
        page,
        limit: 20,
        search,
        element,
        weaponType,
        rarity: rarity ? Number(rarity) : undefined,
        sort: "-rarity,name",
      }),
    [game, page, search, element, weaponType, rarity]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Characters</h1>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total} total
          </span>
        )}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder="Search characters..."
        filterGroups={CHARACTER_FILTERS}
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <ResourceGrid
        loading={loading}
        empty={(data?.data.length ?? 0) === 0 && !loading}
        emptyMessage="No characters found"
      >
        {data?.data.map((c) => (
          <CharacterCard key={c._id} character={c} game={game!} />
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
