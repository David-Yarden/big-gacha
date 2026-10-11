import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { TrimmedImage } from "@/components/shared/TrimmedImage";
import { RarityStars } from "@/components/shared/RarityStars";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getWeapon } from "@/lib/api";
import { weaponIconUrl, weaponFullArtUrl, statIconUrl, materialIconUrlById, materialFallbackIconUrlById } from "@/lib/images";
import {
  ASCENSION_LEVELS,
  levelToAscensionPhase,
  calculateAscensionMaterials,
  expPotions,
  mergeAllMaterials,
} from "@/lib/materials";
import { RARITY_COLOR_MAP } from "@/lib/constants";
import { gameUi } from "@/lib/gameUi";
import { resourceLabel } from "@/lib/registry";
import { formatBaseAtk, formatSpecialized } from "@/lib/formatters";
import type { Game } from "@/lib/types";
import type { MaterialCostEntry } from "@/lib/materials";
import { GameText, renderMarkdownText } from "@/components/character/shared";
import { UnitBanners } from "@/components/shared/UnitBanners";
import { keyName } from "@/lib/i18n";
import { ArtGallery } from "@/components/character/ArtGallery";

function MaterialCostTable({ materials, game }: { materials: MaterialCostEntry[]; game?: string }) {
  if (materials.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No materials required</p>
    );
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-3 py-2 text-left font-medium">Material</th>
            <th className="px-3 py-2 text-right font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((mat) => (
            <tr key={mat.name} className="border-b last:border-0">
              <td className="px-3 py-1.5">
                <span className="flex items-center gap-2">
                  <ImageWithFallback
                    src={mat.icon ?? (game === "genshin" ? materialIconUrlById(mat.id) : null)}
                    fallbackSrc={!mat.icon && game === "genshin" ? materialFallbackIconUrlById(mat.id) : null}
                    alt={mat.name}
                    className="h-6 w-6 shrink-0 object-contain"
                  />
                  {mat.name}
                </span>
              </td>
              <td className="px-3 py-1.5 text-right font-mono">
                {mat.count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WeaponDetailPage() {
  const { game, name } = useParams<{ game: string; name: string }>();
  const ui = gameUi(game);
  const maxLevel = ui.weaponMaxLevel ?? 90;
  const ascensionLevels = ui.weaponAscensionLevels ?? ASCENSION_LEVELS;
  const toPhase = ui.weaponLevelToPhase ?? levelToAscensionPhase;
  const [weaponLevel, setWeaponLevel] = useState(maxLevel);
  const [refinement, setRefinement] = useState(0);

  const { data, loading, error } = useApiQuery(
    () => getWeapon(game as Game, name!),
    [game, name]
  );

  const weapon = data?.data;
  const rarityClass = RARITY_COLOR_MAP[weapon?.rarity ?? 1] ?? "bg-muted";

  const ascensionPhase = toPhase(weaponLevel);
  // Promotion materials, plus EXP items when the game defines the weapon's EXP curve (ZZZ)
  const ascensionMaterials = useMemo(
    () =>
      mergeAllMaterials(
        calculateAscensionMaterials(weapon?.costs, ascensionPhase),
        expPotions(weaponLevel, weapon ?? undefined)
      ),
    [weapon, ascensionPhase, weaponLevel]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !weapon) {
    return (
      <div className="space-y-4">
        <Link to={`/${game}/weapons`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Weapon not found"}
        </div>
      </div>
    );
  }

  const refinements = weapon.refinements ?? [];
  // Endfield weapon skills have levels (1–9), not refinements
  const refLabel = game === "endfield" || game === "czn" ? "Lv." : "R";
  const fullArt = weaponFullArtUrl(weapon.images);
  const currentRefinement = refinements[refinement];

  function renderEffect(template: string, values: string[]) {
    // Strip color tags, then split on {0}, {1}, ... placeholders
    const clean = template.replace(/<color=[^>]*>/g, "").replace(/<\/color>/g, "");
    const parts = clean.split(/\{(\d+)\}/);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const val = values[parseInt(part)];
        return <span key={i} className="font-bold text-amber-400">{val ?? `{${part}}`}</span>;
      }
      return <span key={i}>{renderMarkdownText(part)}</span>;
    });
  }

  return (
    <div className="space-y-6">
      <Link to={`/${game}/weapons`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" /> {resourceLabel(game, "weapons", "Weapons")}
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row">
        {fullArt ? (
          // The whole weapon, its transparent margins trimmed: the frame fits the art
          <div className="flex shrink-0 justify-center md:justify-start">
            <Card className={`relative w-fit items-center gap-0 overflow-hidden px-6 py-6 ${rarityClass}/10`}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_45%,rgba(255,255,255,0.06)_0%,transparent_100%)]" />
              <div className="relative">
                <TrimmedImage src={fullArt} fallbackSrc={weaponIconUrl(weapon.images)} alt={weapon.name} maxWidth={220} maxHeight={400} />
              </div>
            </Card>
          </div>
        ) : (
          <div className="w-full md:w-64 shrink-0">
            <Card className={`overflow-hidden ${rarityClass}/10`}>
              <ImageWithFallback
                src={weaponIconUrl(weapon.images)}
                alt={weapon.name}
                className="w-full h-64 object-contain p-4"
              />
            </Card>
          </div>
        )}

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{weapon.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <RarityStars rarity={weapon.rarity} className="text-lg" />
              {weapon.weaponType && (
                <Badge variant="secondary">{weapon.weaponType}</Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {weapon.stats?.[weaponLevel] ? (
              <div>
                <span className="text-muted-foreground">Base ATK: </span>
                <span className="font-medium">{Math.round(weapon.stats[weaponLevel].atk).toLocaleString()}</span>
              </div>
            ) : weapon.baseAtkValue ? (
              <div>
                <span className="text-muted-foreground">Base ATK: </span>
                {formatBaseAtk(weapon.baseAtkValue)}
              </div>
            ) : null}
            {weapon.mainStatText && weapon.stats?.[weaponLevel]?.specialized != null ? (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-muted-foreground">Substat: </span>
                {statIconUrl(weapon.mainStatType) && (
                  <img src={statIconUrl(weapon.mainStatType)!} className="h-3.5 w-3.5 opacity-70 shrink-0" alt="" />
                )}
                <span>{weapon.mainStatText}</span>
                <span className="font-medium text-amber-400">
                  {formatSpecialized(weapon.stats[weaponLevel].specialized, weapon.mainStatType)}
                </span>
              </div>
            ) : weapon.mainStatText ? (
              <div>
                <span className="text-muted-foreground">Substat: </span>
                {weapon.mainStatText} ({weapon.baseStatText})
              </div>
            ) : null}
            {weapon.signatureOf && (
              <div>
                <span className="text-muted-foreground">Signature of: </span>
                <Link to={`/${game}/characters/${encodeURIComponent(weapon.signatureOf)}`} className="font-medium text-primary hover:underline">
                  {weapon.signatureOf}
                </Link>
              </div>
            )}
            {weapon.version && (
              <div>
                <span className="text-muted-foreground">Version: </span>
                {weapon.version}
              </div>
            )}
          </div>

          {weapon.description && (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {game === "czn" ? <GameText text={weapon.description} /> : weapon.description}
            </p>
          )}
        </div>
      </div>

      {/* Weapon Effect */}
      {weapon.effectName && refinements.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{weapon.effectName}</h3>
              <span className="text-sm font-medium">{refLabel}{refinement + 1}</span>
            </div>
            <Slider
              min={1}
              max={refinements.length}
              step={1}
              value={[refinement + 1]}
              onValueChange={([v]) => setRefinement(v - 1)}
            />
            <div className="flex justify-between text-xs text-muted-foreground px-0.5">
              {refinements.map((_, i) => (
                <span
                  key={i}
                  className={`cursor-pointer ${refinement === i ? "text-primary font-bold" : ""}`}
                  onClick={() => setRefinement(i)}
                >
                  {refLabel}{i + 1}
                </span>
              ))}
            </div>
            {weapon.effectTemplateRaw && currentRefinement?.values ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {renderEffect(weapon.effectTemplateRaw, currentRefinement.values)}
              </p>
            ) : currentRefinement?.description ? (
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {game === "czn" ? <GameText text={currentRefinement.description} /> : renderMarkdownText(currentRefinement.description)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* CZN partner: its Ego skill card */}
      {weapon.egoSkill?.name && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-slate-200 to-slate-400 font-black text-slate-900 ring-2 ring-black/40" title="Cost">
                {weapon.egoSkill.cost ?? "–"}
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Ego skill</p>
                <h3 className="font-semibold">{weapon.egoSkill.name}</h3>
              </div>
            </div>
            {weapon.egoSkill.desc && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                <GameText text={weapon.egoSkill.desc} />
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Artwork at full size (CZN partners) */}
      {(weapon.gallery?.length || weapon.animated?.length) ? (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Gallery</h3>
          <ArtGallery gallery={weapon.gallery} animated={weapon.animated} />
        </section>
      ) : null}

      {/* Ascension Materials (CZN: no cost data yet) */}
      {game !== "czn" && <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Ascension Materials</h3>
            <span className="text-sm text-muted-foreground">
              Lv. {weaponLevel} (Phase {ascensionPhase})
            </span>
          </div>
          <Slider
            min={1}
            max={maxLevel}
            step={1}
            value={[weaponLevel]}
            onValueChange={([v]) => setWeaponLevel(v)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            {ascensionLevels.map((l) => (
              <button
                key={l}
                className={`px-1 ${weaponLevel === l ? "text-primary font-bold" : ""}`}
                onClick={() => setWeaponLevel(l)}
              >
                {l}
              </button>
            ))}
          </div>
          <MaterialCostTable materials={ascensionMaterials} game={game} />
        </CardContent>
      </Card>}

      {game !== "czn" && <UnitBanners game={game!} name={keyName(weapon)} kind="weapon" />}
    </div>
  );
}
