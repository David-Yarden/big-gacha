import { useState, useMemo, useEffect, type ReactNode } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ImageWithFallback, viaCache } from "@/components/shared/ImageWithFallback";
import { formatDate } from "@/lib/banners";
import { TrimmedImage } from "@/components/shared/TrimmedImage";
import { ClassIcon } from "@/components/shared/ClassIcon";
import { RarityStars } from "@/components/shared/RarityStars";
import { TotalCostCalculator } from "@/components/character/TotalCostCalculator";
import { MaterialCostTable, StatIcon, GlossaryContext, GameText, type GlossaryTerm } from "@/components/character/shared";
import { KITS, useNoKit } from "@/components/character/kits";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getCharacter, getAgentKit } from "@/lib/api";
import { hsrPathIconUrl } from "@/lib/images";
import { formatSpecialized } from "@/lib/formatters";
import { calculateAscensionMaterials, mergeAllMaterials } from "@/lib/materials";
import { resolveRegion } from "@/lib/constants";
import { gameUi } from "@/lib/gameUi";
import { registryGame, resourceLabel } from "@/lib/registry";
import type { Character, Game } from "@/lib/types";
import { UnitBanners } from "@/components/shared/UnitBanners";
import { ArtGallery } from "@/components/character/ArtGallery";
import { keyName } from "@/lib/i18n";

const NO_TERMS: GlossaryTerm[] = [];

/**
 * Character page = shared header + level/ascension tab + the game's "kit"
 * (skills, duplicates, controls) from components/character/kits.
 */
export function CharacterDetailPage() {
  const { game = "genshin", name = "" } = useParams<{ game: string; name: string }>();
  // Remount per character: levels and selections start fresh, and the kit hook
  // chosen for a game never changes during a component's life.
  return <CharacterDetail key={`${game}/${name}`} game={game as Game} name={name} />;
}

function CharacterDetail({ game, name }: { game: Game; name: string }) {
  const ui = gameUi(game);
  const useKit = KITS[game] ?? useNoKit;

  const [charLevel, setCharLevel] = useState(ui.maxLevel);
  const [activeElement, setActiveElement] = useState<string | null>(null);

  const { data: charData, loading, error } = useApiQuery(() => getCharacter(game, name), [game, name]);
  // CZN: the art of every card of the combatant, for the gallery
  const { data: kitData } = useApiQuery(() => (game === "czn" ? getAgentKit(game, name) : Promise.resolve(null)), [game, name]);
  const cardArt = useMemo(() => {
    const cards = ((kitData?.data as { cards?: Array<{ name: string; image?: string }> } | undefined)?.cards ?? []).filter((c) => c.image);
    const seen = new Set<string>();
    // One picture per card: the starting cards repeat (two "Amp Therapy" with their own file)
    return cards
      .filter((c) => !seen.has(c.image!) && !seen.has(c.name) && seen.add(c.image!) && seen.add(c.name))
      .map((c) => ({ label: c.name, src: c.image! }));
  }, [kitData]);
  const baseCharacter = charData?.data;
  // Trailblazer / Rover: the selected element's own path, stats, costs and art
  const character = useMemo(() => withVariant(baseCharacter, activeElement), [baseCharacter, activeElement]);

  useEffect(() => {
    if (character?.availableElements?.length && !activeElement) {
      setActiveElement(character.availableElements[0]);
    }
  }, [character, activeElement]);

  // Reached through a French name: continue on the English one (kits, builds and
  // overrides are keyed by it)
  const navigate = useNavigate();
  useEffect(() => {
    if (baseCharacter?._name && baseCharacter._name !== name) {
      navigate(`/${game}/characters/${encodeURIComponent(baseCharacter._name)}`, { replace: true });
    }
  }, [baseCharacter, name, game, navigate]);

  const kit = useKit({ game, name, activeElement, element: character?.element });

  const ascensionPhase = ui.levelToPhase(Math.min(charLevel, ui.maxLevel));
  const levelMaterials = useMemo(
    () => mergeAllMaterials(calculateAscensionMaterials(character?.costs, ascensionPhase), ui.levelMaterials(charLevel, character ?? undefined)),
    [character, ascensionPhase, charLevel, ui]
  );
  const totalMaterials = useMemo(
    () => mergeAllMaterials(levelMaterials, ...kit.skillSections.map((s) => s.materials)),
    [levelMaterials, kit.skillSections]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[480px] w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="space-y-4">
        <BackLink game={game} />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Character not found"}
        </div>
      </div>
    );
  }

  const isMultiElement = !!character.availableElements?.length;
  const displayElement = isMultiElement ? (activeElement ?? character.element) : character.element;
  const elementClass = ui.elementColor[displayElement ?? ""] ?? "bg-muted";
  const [skillsTab] = kit.tabs;
  const hasBanners = !!registryGame(game)?.resources.some((r) => r.kind === "banners");
  const hasGallery = !!(character?.gallery?.length || character?.animated?.length);

  return (
    <GlossaryContext.Provider value={character.glossary ?? NO_TERMS}>
    <div className="space-y-6">
      <BackLink game={game} />

      <CharacterHeader character={character} game={game} element={displayElement} elementClass={elementClass} />

      {/* Element / path selector for multi-element characters */}
      {isMultiElement && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">{ui.variantLabel}</span>
          {character.availableElements!.map((el) => {
            const isActive = activeElement === el;
            const icon = ui.elementIcon(el);
            return (
              <button
                key={el}
                onClick={() => setActiveElement(el)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-all ${
                  isActive
                    ? `${ui.elementColor[el] ?? "bg-muted"} text-white ring-2 ring-white/60 ring-offset-2 ring-offset-background`
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {icon && <img src={icon} className="h-4 w-4" alt="" />}
                {el}
              </button>
            );
          })}
        </div>
      )}

      {kit.controls}

      <Tabs defaultValue={skillsTab?.value ?? "ascension"}>
        <TabsList>
          {kit.tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
          <TabsTrigger value="ascension">Ascension</TabsTrigger>
          {hasGallery && <TabsTrigger value="gallery">Gallery</TabsTrigger>}
          {hasBanners && <TabsTrigger value="banners">Banners</TabsTrigger>}
        </TabsList>

        {kit.tabs.map((t) => (
          <TabsContent key={t.value} value={t.value}>{t.content}</TabsContent>
        ))}

        <TabsContent value="ascension">
          <AscensionPanel
            character={character}
            game={game}
            level={charLevel}
            onLevelChange={setCharLevel}
            phase={ascensionPhase}
            materials={levelMaterials}
          />
        </TabsContent>

        {hasGallery && (
          <TabsContent value="gallery">
            <ArtGallery gallery={character.gallery} animated={character.animated} cards={cardArt} />
          </TabsContent>
        )}

        <TabsContent value="banners">
          <UnitBanners game={game} name={keyName(character)} kind="character" bare />
        </TabsContent>
      </Tabs>

      <TotalCostCalculator
        ascensionMaterials={levelMaterials}
        skillSections={kit.skillSections}
        skillsLabel={kit.skillsLabel}
        totalMaterials={totalMaterials}
        charLevel={charLevel}
        game={game}
      />
    </div>
    </GlossaryContext.Provider>
  );
}

function withVariant(character: Character | undefined, element: string | null): Character | undefined {
  const variant = element ? character?.elementVariants?.[element] : undefined;
  if (!character || !variant) return character;
  return {
    ...character,
    ...variant,
    element,
    images: { ...(character.images ?? {}), ...(variant.images ?? {}) },
  };
}

function BackLink({ game }: { game: string }) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link to={`/${game}/characters`}>
        <ArrowLeft className="mr-1 h-4 w-4" /> {resourceLabel(game, "characters", "Characters")}
      </Link>
    </Button>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

/**
 * Splash art, with the character's outfits as thumbnails underneath: a click shows that
 * outfit's art, its name and description. Nothing extra for characters without outfits.
 */
/**
 * Share of fully transparent rows at the top of an image (0 when unreadable).
 * WuWa portraits are drawn low in their 696×960 canvas: the frame drops that empty band.
 */
function useEmptyTop(src: string | null | undefined, enabled: boolean): number {
  const [top, setTop] = useState(0);
  useEffect(() => {
    setTop(0);
    if (!enabled || !src) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const W = 120;
        const H = Math.round((img.naturalHeight / img.naturalWidth) * W);
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;
        let y = 0;
        rows: for (; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 16) break rows;
        // Keep a little air above the head; never cut more than a third
        setTop(Math.min(Math.max(0, y / H - 0.03), 0.33));
      } catch {
        /* cross-origin pixels: keep the full frame */
      }
    };
    img.src = viaCache(src) ?? src;
    return () => {
      cancelled = true;
    };
  }, [src, enabled]);
  return top;
}

function SplashWithOutfits({ character, game, elementClass }: { character: Character; game: Game; elementClass: string }) {
  const ui = gameUi(game);
  const skins = character.skins ?? [];
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [character.name]);
  const skin = skins[selected];
  const src = skin && !skin.default ? skin.splash : ui.splash(character.images);
  const emptyTop = useEmptyTop(src, game === "wuwa");

  return (
    <div className="mx-auto w-full max-w-[340px] space-y-3 md:mx-0">
      {/* Splash in portrait: WuWa art fits exactly, wider art is cropped around the character */}
      <Card
        className={`relative w-full gap-0 overflow-hidden py-0 transition-[aspect-ratio] duration-300 ${elementClass}/20`}
        style={{ aspectRatio: `696 / ${Math.round(960 * (1 - emptyTop))}` }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_30%,transparent_0%,rgba(0,0,0,0.35)_100%)]" />
        <ImageWithFallback
          key={src ?? ""}
          src={src}
          // Served from the local image copy (src/routes/img.js), like every other image
          alt={skin?.name ?? character.name}
          className={`relative h-full w-full ${
            skin?.fit === "contain" && !skin.default ? "object-contain p-6" : `object-cover ${emptyTop > 0 ? "object-bottom" : "object-top"}`
          }`}
        />
      </Card>

      {skins.length > 1 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Outfits">
            {skins.map((sk, i) => (
              <button
                key={sk.name ?? i}
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={i === selected}
                title={sk.name}
                className={`h-14 w-14 overflow-hidden rounded-lg border-2 bg-muted/40 transition-colors ${
                  i === selected ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <ImageWithFallback src={sk.icon ?? null} alt={sk.name ?? ""} className="h-full w-full object-cover object-top" />
              </button>
            ))}
          </div>
          {skin && (
            <div className="text-sm">
              <p className="font-semibold">
                {skin.name ?? "Outfit"}
                {skin.default && <span className="ml-2 text-xs font-normal text-muted-foreground">Default</span>}
              </p>
              {skin.desc && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{skin.desc}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CharacterHeader({
  character,
  game,
  element,
  elementClass,
}: {
  character: Character;
  game: Game;
  element?: string;
  elementClass: string;
}) {
  const ui = gameUi(game);
  const elementIcon = ui.elementIcon(character.subElement ?? element) ?? ui.elementIcon(element);
  const weaponIcon = ui.weaponTypeIcon?.(character.weaponType);
  const pathIcon = ui.showPath ? hsrPathIconUrl(character.path) : null;

  const voices = character.cv
    ? ([
        ["EN", character.cv.english],
        ["JP", character.cv.japanese],
        ["CN", character.cv.chinese],
        ["KR", character.cv.korean],
      ] as const).filter(([, v]) => v)
    : [];

  return (
    <section className="grid gap-6 md:grid-cols-[minmax(240px,340px)_minmax(0,1fr)] md:gap-8">
      <SplashWithOutfits character={character} game={game} elementClass={elementClass} />

      <div className="flex min-w-0 flex-col gap-5 md:pt-1">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            {character.images?.chibi && (
              // In-game chibi face (CZN bookmark)
              <ImageWithFallback
                src={character.images.chibi}
                alt=""
                className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]"
                imgClassName="h-full w-full object-cover"
              />
            )}
            <h1 className="text-4xl font-extrabold tracking-tight">{character.name}</h1>
            {element && element !== "None" && (
              <Badge className={`${elementClass} flex items-center gap-1 border-0 text-white`}>
                {elementIcon &&
                  (game === "endfield" ? (
                    // Endfield glyphs sit off-centre in their PNG: trim them
                    <span className="inline-flex h-4 w-4 items-center justify-center">
                      <TrimmedImage src={elementIcon} alt="" maxWidth={14} maxHeight={14} />
                    </span>
                  ) : (
                    <img src={elementIcon} className="h-4 w-4" alt="" />
                  ))}
                {character.subElement ?? element}
              </Badge>
            )}
            <RarityStars rarity={character.rarity} className="text-lg" badge />
          </div>
          {character.title && <p className="text-muted-foreground">{character.title}</p>}
        </div>

        {character.description && (
          <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
            <GameText text={character.description} />
          </p>
        )}

        {/* One panel: label / value rows in two columns, voice actors at the bottom */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-card/70">
          <dl className="-mb-px grid px-5 sm:grid-cols-2 sm:gap-x-10">
            {ui.showPath && character.path && (
              <InfoCell label="Path">
                {pathIcon && <img src={pathIcon} className="h-4 w-4" alt="" />}
                {character.path}
              </InfoCell>
            )}
            {!ui.showPath && character.weaponType && (
              <InfoCell label="Weapon">
                {weaponIcon && (
                  <img
                    src={weaponIcon}
                    className="h-4 w-4"
                    alt=""
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                )}
                {character.weaponType}
              </InfoCell>
            )}
            {ui.showRegion && (
              <InfoCell label="Region">
                <InlineIcon src={registryGame(game)?.regionIcons?.[character.region ?? ""] ?? null} className="h-6 w-6" />
                {resolveRegion(character.region, keyName(character))}
              </InfoCell>
            )}
            {character.specialty && (
              <InfoCell label={game === "endfield" || game === "czn" ? "Class" : "Specialty"}>
                {ui.specialtyIcon?.(character.specialty) && (
                  <ClassIcon src={ui.specialtyIcon(character.specialty)!} size={18} />
                )}
                {character.specialty}
              </InfoCell>
            )}
            {character.subElement && (
              <InfoCell label="Attribute">
                <InlineIcon src={ui.elementIcon(character.subElement)} />
                {`${character.subElement} (${character.element})`}
              </InfoCell>
            )}
            {character.attackType && (
              <InfoCell label="Attack type">
                {character.attackType.split(" / ").map((a) => (
                  <span key={a} className="inline-flex items-center gap-1">
                    <InlineIcon src={ui.attackTypeIcon?.(a)} />
                    {a}
                  </span>
                ))}
              </InfoCell>
            )}
            {character.substatText && (
              <InfoCell label="Ascension stat">
                <StatIcon substatType={character.substatType} className="h-3.5 w-3.5 shrink-0 opacity-70" />
                {character.substatText}
              </InfoCell>
            )}
            {character.affiliation && (
              <InfoCell label={game === "zzz" || game === "endfield" ? "Faction" : "Affiliation"}>
                <InlineIcon
                  src={character.images?.faction ?? registryGame(game)?.regionIcons?.[character.affiliation] ?? null}
                  className="h-6 w-6"
                />
                {character.affiliation}
              </InfoCell>
            )}
            {character.constellation && <InfoCell label="Constellation">{character.constellation}</InfoCell>}
            {character.birthday && <InfoCell label="Birthday">{character.birthday}</InfoCell>}
            {character.signatureWeapon && (
              <InfoCell label="Signature">
                <Link
                  to={`/${game}/${game === "hsr" ? "lightcones" : "weapons"}/${encodeURIComponent(character.signatureWeapon)}`}
                  className="text-primary hover:underline"
                >
                  {character.signatureWeapon}
                </Link>
              </InfoCell>
            )}
            {character.gender && <InfoCell label="Gender">{character.gender}</InfoCell>}
            {character.height && <InfoCell label="Height">{character.height}</InfoCell>}
            {character.profile?.map((p) => (
              <InfoCell key={p.name} label={p.name} wide={p.value.length > 24}>
                {p.value}
              </InfoCell>
            ))}
            {character.version && (
              <InfoCell label="Release">
                {/^\d{4}-\d{2}-\d{2}$/.test(character.version) ? formatDate(character.version) : `Version ${character.version}`}
              </InfoCell>
            )}
          </dl>

          {voices.length > 0 && (
            <div className="relative flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/[0.06] bg-white/[0.02] px-5 py-3 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Voice</span>
              {voices.map(([lang, name]) => (
                <span key={lang} className="whitespace-nowrap">
                  <span className="mr-1.5 text-xs font-semibold text-muted-foreground">{lang}</span>
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Small icon next to a value; hidden when missing or broken. */
function InlineIcon({ src, className = "h-4 w-4" }: { src?: string | null; className?: string }) {
  if (!src) return null;
  return (
    <img
      src={viaCache(src) ?? src}
      alt=""
      className={`${className} shrink-0 object-contain`}
      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
    />
  );
}

function InfoCell({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`flex min-w-0 items-baseline justify-between gap-4 border-b border-white/[0.06] py-3 text-sm ${wide ? "col-span-full" : ""}`}>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-1.5 text-right font-semibold">{children}</dd>
    </div>
  );
}

// ── Level / ascension ─────────────────────────────────────────────────────────

function AscensionPanel({
  character,
  game,
  level,
  onLevelChange,
  phase,
  materials,
}: {
  character: Character;
  game: Game;
  level: number;
  onLevelChange: (level: number) => void;
  phase: number;
  materials: ReturnType<typeof mergeAllMaterials>;
}) {
  const ui = gameUi(game);
  const inBreakthrough = level > ui.maxLevel;
  const stats = character.stats?.[level];

  const rows: Array<{ label: string; statType: string; value: string }> = [];
  if (stats) {
    rows.push(
      { label: "HP",  statType: "FIGHT_PROP_HP",      value: Math.round(stats.hp).toLocaleString() },
      { label: "ATK", statType: "FIGHT_PROP_ATTACK",  value: Math.round(stats.atk).toLocaleString() },
      { label: "DEF", statType: "FIGHT_PROP_DEFENSE", value: Math.round(stats.def).toLocaleString() },
    );
    const spd = (stats as Record<string, number>).spd;
    if (spd != null) {
      rows.push({ label: "SPD", statType: "Speed", value: Math.round(spd).toString() });
    } else if (character.substatText) {
      rows.push({
        label: character.substatText,
        statType: character.substatType ?? "",
        value: formatSpecialized(stats.specialized, character.substatType),
      });
    }
    // Other stats that grow with level (Endfield: Strength, Agility, Intellect, Will)
    for (const [label, v] of Object.entries((stats as { extra?: Record<string, number> }).extra ?? {})) {
      rows.push({ label, statType: "", value: Math.round(v).toLocaleString() });
    }
    // Base stats that do not grow with level (ZZZ: Impact, CRIT, Anomaly…)
    for (const x of Array.isArray(character.extraStats) ? character.extraStats : []) rows.push({ label: x.name, statType: "", value: x.value });
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{ui.levelLabel}</h3>
          <span className="text-sm text-muted-foreground">
            Lv. {level}{inBreakthrough ? " (Breakthrough)" : ` (Phase ${phase})`}
          </span>
        </div>
        <Slider
          min={1}
          max={ui.maxLevel}
          step={1}
          value={[Math.min(level, ui.maxLevel)]}
          onValueChange={([v]) => onLevelChange(v)}
          disabled={inBreakthrough}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          {ui.ascensionLevels.map((l) => (
            <button
              key={l}
              className={`px-1 ${level === l ? "text-primary font-bold" : ""}`}
              onClick={() => onLevelChange(l)}
            >
              {l}
            </button>
          ))}
        </div>
        {ui.breakthroughLevels.length > 0 && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <span className="text-xs text-muted-foreground shrink-0">Breakthrough</span>
            {ui.breakthroughLevels.map((l) => (
              <button
                key={l}
                onClick={() => onLevelChange(level === l ? ui.maxLevel : l)}
                className={`px-3 py-0.5 rounded text-xs border transition-colors ${
                  level === l
                    ? "border-amber-400 text-amber-400 font-bold bg-amber-400/10"
                    : "border-muted-foreground/30 text-muted-foreground hover:border-amber-400/60 hover:text-amber-400"
                }`}
              >
                Lv. {l}
              </button>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium" colSpan={2}>Base Stats at Lv. {level}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ label, statType, value }) => (
                  <tr key={label} className="border-b last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <StatIcon substatType={statType} className="h-4 w-4 opacity-70 shrink-0" />
                        {label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <MaterialCostTable materials={materials} game={game} />
      </CardContent>
    </Card>
  );
}
