import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterBar } from "@/components/shared/FilterBar";
import { ResourceGrid } from "@/components/shared/ResourceGrid";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { TrimmedImage } from "@/components/shared/TrimmedImage";
import { ClassIcon } from "@/components/shared/ClassIcon";
import { StatusTag } from "@/components/shared/StatusTag";
import { RarityStars, rarityLabel, rankIcon, rarityTextClass } from "@/components/shared/RarityStars";
import { getCharacters, getEnhancements } from "@/lib/api";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { CHARACTER_RARITIES, RARITY_COLOR_MAP, resolveRegion } from "@/lib/constants";
import { gameUi } from "@/lib/gameUi";
import { keyName } from "@/lib/i18n";
import { registryGame, resourceLabel } from "@/lib/registry";
import type { Game, Character, EnhancementType } from "@/lib/types";
import type { FilterGroup, SortOption } from "@/components/shared/FilterBar";

const SORT_OPTIONS: SortOption[] = [
  { value: "name", label: "Name" },
  { value: "version", label: "Release" },
];

/** Filters built from the registry (shared/games.json) + the game's icons. */
function filtersFor(
  game: string,
  enhancementTypes: EnhancementType[] = [],
  /** Factions read from the data (ZZZ): new ones appear without editing the registry */
  dataRegions: Array<{ name: string; icon?: string }> = []
): FilterGroup[] {
  const reg = registryGame(game);
  const ui = gameUi(game);
  const groups: FilterGroup[] = [];

  if (reg?.elements?.length) {
    groups.push({
      key: "element",
      label: "Element",
      options: reg.elements.map((el) => ({ value: el, label: el, icon: ui.elementIcon(el) ?? undefined, iconClass: game === "endfield" ? ui.elementColor[el] : undefined })),
    });
  }
  if (reg?.paths?.length) {
    groups.push({
      key: "path",
      label: "Path",
      options: reg.paths.map((p) => ({ value: p, label: p, icon: ui.pathIcon?.(p) ?? undefined })),
    });
  }
  if (reg?.specialties?.length) {
    groups.push({
      key: "specialty",
      label: game === "endfield" || game === "czn" ? "Class" : "Specialty",
      options: reg.specialties.map((sp) => ({ value: sp, label: sp, icon: ui.specialtyIcon?.(sp) ?? undefined })),
    });
  }
  if (reg?.weaponTypes?.length) {
    groups.push({
      key: "weaponType",
      label: "Weapon",
      options: reg.weaponTypes.map((wt) => ({ value: wt, label: wt, icon: ui.weaponTypeIcon?.(wt) ?? undefined })),
    });
  }
  groups.push({
    key: "rarity",
    label: "Rarity",
    options: (reg?.rarities ?? CHARACTER_RARITIES).map((r) => ({ value: String(r), label: rarityLabel(game, r), icon: rankIcon(game, r), labelClass: game === "endfield" ? rarityTextClass(r) : undefined })),
  });
  if (reg?.regions?.length) {
    const known = new Set(reg.regions);
    const extra = dataRegions.filter((r) => !known.has(r.name));
    const icon = (name: string) => reg.regionIcons?.[name] ?? dataRegions.find((r) => r.name === name)?.icon;
    groups.push({
      key: "region",
      label: reg.regionLabel ?? "Region",
      options: [...reg.regions, ...extra.map((r) => r.name)].map((r) => ({ value: r, label: r, icon: icon(r) })),
      iconOnly: !!reg.regionIcons,
    });
  }
  if (enhancementTypes.length) {
    groups.push({
      key: "enhancements",
      label: "Enhancement",
      options: enhancementTypes.map((t) => ({ value: t.id, label: t.version ? `${t.name} ${t.version}` : t.name })),
    });
  }
  return groups;
}

function CharacterCard({ character, game }: { character: Character; game: string }) {
  const ui = gameUi(game);
  const elementClass = ui.elementColor[character.element ?? ""] ?? "bg-muted";
  const rarityClass = RARITY_COLOR_MAP[character.rarity] ?? "bg-muted";
  const elementIcon = ui.elementIcon(character.subElement ?? character.element) ?? ui.elementIcon(character.element);
  const subIcon = character.specialty
    ? ui.specialtyIcon?.(character.specialty)
    : ui.showPath
      ? ui.pathIcon?.(character.path)
      : ui.weaponTypeIcon?.(character.weaponType);
  const subLabel = character.specialty ?? (ui.showPath ? character.path : character.weaponType);

  return (
    <Link to={`/${game}/characters/${encodeURIComponent(character.name)}`}>
      <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-primary/40">
        <div className={`relative flex aspect-square items-center justify-center overflow-hidden ${rarityClass}/20`}>
          <ImageWithFallback
            src={ui.portrait(character.images)}
            alt={character.name}
            className={`h-full w-full ${ui.portraitFit === "cover" ? "object-cover object-top" : "object-contain"} transition-transform duration-300 group-hover:scale-105`}
          />
          {(character.upcoming || character.limited) && (
            <span className="absolute top-1.5 left-1.5 flex flex-col items-start gap-1">
              {character.upcoming && <StatusTag kind="upcoming" />}
              {character.limited && <StatusTag kind="limited" />}
            </span>
          )}
          {character.enhancements && character.enhancements.length > 0 && (
            <span
              className="absolute bottom-2 left-2 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 backdrop-blur-sm"
              title={`Enhancements: ${character.enhancements.join(", ")}`}
            >
              ✦ {character.enhancements.length}
            </span>
          )}
          {character.element && character.element !== "None" && (
            <Badge
              className={`absolute top-1.5 right-1.5 ${elementClass} flex items-center gap-1 border-0 px-1.5 py-0 text-[11px] text-white`}
              title={character.subElement ?? character.element}
            >
              {elementIcon &&
                (game === "endfield" ? (
                  // Endfield glyphs sit off-centre in their PNG: trim them
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center">
                    <TrimmedImage src={elementIcon} alt="" maxWidth={12} maxHeight={12} />
                  </span>
                ) : (
                  <img src={elementIcon} className="h-3.5 w-3.5" alt="" />
                ))}
              <span className="hidden sm:inline">{character.subElement ?? character.element}</span>
            </Badge>
          )}
        </div>
        <CardContent className="px-2.5 py-2">
          <p className="font-semibold text-sm truncate">{character.name}</p>
          <div className="mt-1 flex items-center justify-between gap-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 truncate">
              {subIcon && <ClassIcon src={subIcon} size={14} />}
              {subLabel}
            </span>
            <RarityStars rarity={character.rarity} className="shrink-0 text-xs" />
          </div>
          {ui.showRegion && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {resolveRegion(character.region, keyName(character))}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function buildSort(sortBy: string, sortDir: string): string {
  const desc = sortDir === "desc";
  // Announced characters come after the newest release (not released yet)
  if (sortBy === "version") return desc ? "-upcoming,-version,name" : "upcoming,version,name";
  if (sortBy === "name") return desc ? "-name" : "name";
  return "-rarity,name";
}

export function CharactersPage() {
  const { game = "genshin" } = useParams<{ game: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: enhData } = useApiQuery(() => getEnhancements(game as Game), [game]);
  // Factions present in the data, with their emblem (games with emblems only)
  const hasEmblems = !!registryGame(game)?.regionIcons;
  const { data: regionData } = useApiQuery(
    () => (hasEmblems ? getCharacters(game as Game, { limit: 100, fields: "region,images" }) : Promise.resolve(null)),
    [game, hasEmblems]
  );
  const dataRegions = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const c of regionData?.data ?? []) if (c.region && !m.has(c.region)) m.set(c.region, c.images?.faction);
    return [...m].map(([name, icon]) => ({ name, icon }));
  }, [regionData]);
  const filterGroups = filtersFor(game, enhData?.data.types, dataRegions);
  const filterKeys = filterGroups.map((g) => g.key);

  const search = searchParams.get("search") ?? undefined;
  const sortBy = searchParams.get("sortBy") ?? "version";
  const sortDir = searchParams.get("sortDir") ?? "desc";
  const sort = buildSort(sortBy, sortDir);

  // Only send the filters this game actually has
  const filters: Record<string, string | number | undefined> = {};
  for (const key of filterKeys) {
    const value = searchParams.get(key) ?? undefined;
    filters[key] = key === "rarity" && value ? Number(value) : value;
  }

  const { items, total, loading, error, hasMore, sentinelRef } = useInfiniteList(
    (page) => getCharacters(game as Game, { page, limit: 25, search, sort, ...filters }),
    [game, search, sort, filters]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{resourceLabel(game, "characters", "Characters")}</h1>
        {total > 0 && <span className="text-sm text-muted-foreground">{`${total} total`}</span>}
      </div>

      <FilterBar
        searchParams={searchParams}
        setSearchParams={setSearchParams}
        searchPlaceholder={`Search ${resourceLabel(game, "characters", "characters").toLowerCase()}...`}
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
        emptyMessage="No characters found"
        columns="grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8"
      >
        {items.map((c) => (
          <CharacterCard key={c._id} character={c} game={game} />
        ))}
      </ResourceGrid>

      {loading && items.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <div ref={sentinelRef} className="h-px" />

      {!hasMore && items.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-2">{`All ${total} characters loaded`}</p>
      )}
    </div>
  );
}
