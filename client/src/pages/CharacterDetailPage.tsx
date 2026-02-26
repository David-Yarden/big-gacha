import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { useApiQuery } from "@/hooks/useApiQuery";
import {
  getCharacter,
  getTalent,
  getConstellation,
  getTrace,
  getEidolon,
} from "@/lib/api";
import {
  characterSplashUrl,
  characterIconUrl,
  talentIconUrl,
  constellationIconUrl,
  elementIconUrl,
  weaponTypeIconUrl,
  statIconUrl,
  materialIconUrlById,
  materialFallbackIconUrlById,
  hsrMaterialIconUrl,
  hsrElementIconUrl,
  hsrPathIconUrl,
  hsrStatIconUrl,
  hsrStatName,
} from "@/lib/images";
import { parseLabel, formatSpecialized } from "@/lib/formatters";
import {
  ASCENSION_LEVELS,
  levelToAscensionPhase,
  calculateAscensionMaterials,
  calculateTalentMaterials,
  calculateExpMaterials,
  calculateBreakthroughMaterials,
  mergeAllMaterials,
} from "@/lib/materials";
import {
  ELEMENT_COLOR_MAP,
  HSR_ELEMENT_COLOR_MAP,
  resolveRegion,
} from "@/lib/constants";
import type { Game, TalentCombat, Talent, Constellation, Trace, Eidolon } from "@/lib/types";
import type { MaterialCostEntry } from "@/lib/materials";
import { TotalCostCalculator } from "@/components/character/TotalCostCalculator";

// HSR ascension checkpoints
const HSR_ASCENSION_LEVELS = [1, 20, 30, 40, 50, 60, 70, 80] as const;

function hsrLevelToAscensionPhase(level: number): number {
  if (level <= 20) return 0;
  if (level <= 30) return 1;
  if (level <= 40) return 2;
  if (level <= 50) return 3;
  if (level <= 60) return 4;
  if (level <= 70) return 5;
  return 6;
}

// ── Text rendering helpers ────────────────────────────────────────────────────

/** Converts **bold** markdown to <strong> elements for Genshin descriptions. */
function renderMarkdownText(text: string) {
  const parts = text.split(/\*\*([^*]+)\*\*/);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="text-foreground font-semibold">{part}</strong>
      : part
  );
}

function formatHsrParam(value: number, fmt: string): string {
  switch (fmt.toLowerCase()) {
    case "i": return String(Math.round(value));
    case "f1": return value.toFixed(1);
    case "f2": return value.toFixed(2);
    default: return String(Math.round(value));
  }
}

/**
 * Replaces #N[format] placeholders in HSR skill descriptions with styled spans.
 * Raw param values are fractions for percentages (e.g. 0.5 = 50%) — we detect
 * this by checking if the text immediately after the token starts with "%",
 * then multiply by 100 before formatting.
 */
function parseHsrDesc(desc: string, params: number[][] | undefined, level: number) {
  const levelParams = params ? (params[Math.min(level - 1, params.length - 1)] ?? []) : [];
  const clean = desc.replace(/<[^>]+>/g, "");
  const parts = clean.split(/(#\d+\[[^\]]+\])/);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const m = part.match(/^#(\d+)\[([^\]]+)\]/);
      if (!m) return part;
      const idx = parseInt(m[1]) - 1;
      const fmt = m[2].toLowerCase();
      const raw = levelParams[idx];
      if (raw === undefined) return part;
      const nextPart = parts[i + 1] ?? "";
      const n = nextPart.startsWith("%") ? raw * 100 : raw;
      return (
        <span key={i} className="font-bold text-amber-400">
          {formatHsrParam(n, fmt)}
        </span>
      );
    }
    return part;
  });
}

// ── Hexerei block ─────────────────────────────────────────────────────────────

function HexereiBlock({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-2">
      <p className="text-xs font-semibold text-violet-400 mb-1">Hexerei: Secret Rite</p>
      <p className="text-sm text-violet-200/80">{text}</p>
    </div>
  );
}

// ── Stat icon ────────────────────────────────────────────────────────────────

function StatIcon({ substatType, className = "h-4 w-4 shrink-0" }: { substatType?: string; className?: string }) {
  if (!substatType) return null;
  const url = statIconUrl(substatType) ?? hsrStatIconUrl(substatType);
  if (!url) return null;
  return <img src={url} className={className} alt="" />;
}

// ── Genshin talent section ────────────────────────────────────────────────────

function TalentSection({
  talent,
  level,
  onLevelChange,
  iconUrl,
}: {
  talent: TalentCombat;
  level: number;
  onLevelChange: (v: number) => void;
  iconUrl?: string | null;
}) {
  const labels = talent.attributes?.labels ?? [];
  const parameters = talent.attributes?.parameters;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {iconUrl && (
          <img
            src={iconUrl}
            alt={talent.name}
            className="h-10 w-10 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0"
          />
        )}
        <div className="flex-1 flex items-center justify-between">
          <h4 className="font-semibold">{talent.name}</h4>
          <span className="text-sm text-muted-foreground">Lv. {level}</span>
        </div>
      </div>
      <Slider
        min={1}
        max={15}
        step={1}
        value={[level]}
        onValueChange={([v]) => onLevelChange(v)}
      />
      {talent.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-line">{renderMarkdownText(talent.description)}</p>
      )}
      {labels.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <tbody>
              {labels.map((label, i) => {
                const parsed = parseLabel(label, parameters, level - 1);
                if (!parsed.value) return null;
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {parsed.name}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold text-amber-400">
                      {parsed.value}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PassiveSection({
  passive,
  iconUrl,
}: {
  passive: { name: string; description: string };
  iconUrl?: string | null;
}) {
  return (
    <div className="flex gap-3">
      {iconUrl && (
        <img
          src={iconUrl}
          alt={passive.name}
          className="h-10 w-10 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0 mt-0.5"
        />
      )}
      <div>
        <h4 className="font-semibold">{passive.name}</h4>
        <p className="mt-1 text-sm text-muted-foreground">{renderMarkdownText(passive.description)}</p>
      </div>
    </div>
  );
}

// ── HSR trace section ─────────────────────────────────────────────────────────

function HsrSkillSection({
  skill,
  label,
  level,
  onLevelChange,
  defaultMax,
}: {
  skill: { name: string; maxLevel?: number; desc?: string; params?: number[][]; icon?: string };
  label?: string;
  level: number;
  onLevelChange: (v: number) => void;
  defaultMax: number;
}) {
  const effectiveMax = skill.maxLevel ?? defaultMax;
  const clampedLevel = Math.min(level, effectiveMax);

  return (
    <div className="flex gap-3">
      {skill.icon && (
        <img
          src={skill.icon}
          alt={skill.name}
          className="h-10 w-10 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0 mt-0.5"
        />
      )}
      <div className="flex-1">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {label && <Badge variant="outline" className="text-xs">{label}</Badge>}
            <h4 className="font-semibold">{skill.name}</h4>
          </div>
          {effectiveMax > 1 && (
            <span className="text-sm text-muted-foreground">Lv. {clampedLevel}</span>
          )}
        </div>
        {effectiveMax > 1 && (
          <div className="mt-2">
            <Slider
              min={1}
              max={effectiveMax}
              step={1}
              value={[clampedLevel]}
              onValueChange={([v]) => onLevelChange(v)}
            />
          </div>
        )}
        {skill.desc && (
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
            {parseHsrDesc(skill.desc, skill.params, clampedLevel)}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Material cost table ───────────────────────────────────────────────────────

function MaterialCostTable({ materials, isHsr }: { materials: MaterialCostEntry[]; isHsr?: boolean }) {
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
                    src={mat.icon ?? (isHsr ? hsrMaterialIconUrl(mat.id) : materialIconUrlById(mat.id))}
                    fallbackSrc={isHsr ? undefined : materialFallbackIconUrlById(mat.id)}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export function CharacterDetailPage() {
  const { game, name } = useParams<{ game: string; name: string }>();
  const isHsr = game === "hsr";

  const defaultLevel = isHsr ? 80 : 90;
  const [charLevel, setCharLevel] = useState(defaultLevel);
  const [talent1Level, setTalent1Level] = useState(10);
  const [talent2Level, setTalent2Level] = useState(10);
  const [talent3Level, setTalent3Level] = useState(10);
  const [activeElement, setActiveElement] = useState<string | null>(null);
  const [hsrBasicLevel, setHsrBasicLevel] = useState(6);
  const [hsrSkillLevel, setHsrSkillLevel] = useState(10);
  const [hsrUltLevel, setHsrUltLevel] = useState(10);
  const [hsrTalentLevel, setHsrTalentLevel] = useState(10);
  const [hsrTechLevel, setHsrTechLevel] = useState(10);
  const [elationLevel, setElationLevel] = useState(10);
  const [memospriteGroupLevels, setMemospriteGroupLevels] = useState<number[]>([]);

  const { data: charData, loading: charLoading, error: charError } = useApiQuery(
    () => getCharacter(game as Game, name!),
    [game, name]
  );

  const { data: talentData } = useApiQuery(
    () => isHsr ? getTrace(game as Game, name!) : getTalent(game as Game, name!),
    [game, name]
  );

  const { data: constellationData } = useApiQuery(
    () => isHsr ? getEidolon(game as Game, name!) : getConstellation(game as Game, name!),
    [game, name]
  );

  const character = charData?.data;

  // Genshin-only: talent / constellation
  const talent = !isHsr ? (talentData?.data as Talent | undefined) : undefined;
  const constellation = !isHsr ? (constellationData?.data as Constellation | undefined) : undefined;

  // HSR-only: trace / eidolon
  const trace = isHsr ? (talentData?.data as Trace | undefined) : undefined;
  const eidolon = isHsr ? (constellationData?.data as Eidolon | undefined) : undefined;

  useEffect(() => {
    if (character?.availableElements?.length && !activeElement) {
      setActiveElement(character.availableElements[0]);
    }
  }, [character]);

  // For Travelers (Genshin), derive active variant data from the selected element
  const isTraveler = !!talent?.isTraveler;
  const activeVariant      = isTraveler && activeElement ? talent?.elementVariants?.[activeElement] : null;
  const activeTalent       = activeVariant ?? talent;
  const activeTalentImages = activeVariant?.images ?? talent?.images;

  const activeConstVariant  = constellation?.isTraveler && activeElement
    ? constellation?.elementVariants?.[activeElement]
    : null;
  const activeConstellation  = activeConstVariant ?? constellation;
  const activeConstImages    = activeConstVariant?.images ?? constellation?.images;

  // For Trailblazer (HSR), derive active variant from selected element
  const isTrailblazer = !!trace?.isTraveler;
  const activeTraceVariant = isTrailblazer && activeElement
    ? (trace?.elementVariants?.[activeElement] as Partial<Trace> | undefined)
    : null;
  const activeTrace = activeTraceVariant ?? trace;

  useEffect(() => {
    setMemospriteGroupLevels(
      activeTrace?.memospriteGroups?.map(() => 10) ?? []
    );
  }, [activeTrace]);

  const activeEidolonVariant = eidolon?.isTraveler && activeElement
    ? (eidolon?.elementVariants?.[activeElement] as Partial<Eidolon> | undefined)
    : null;
  const activeEidolon = activeEidolonVariant ?? eidolon;

  // Level/ascension calculations
  const ascLevels = isHsr ? HSR_ASCENSION_LEVELS : ASCENSION_LEVELS;
  const toPhase = isHsr ? hsrLevelToAscensionPhase : levelToAscensionPhase;
  const ascensionPhase = toPhase(charLevel);

  const ascensionMaterials = useMemo(
    () => calculateAscensionMaterials(character?.costs, ascensionPhase),
    [character?.costs, ascensionPhase]
  );
  const expMaterials = useMemo(
    () => isHsr ? [] : calculateExpMaterials(charLevel),
    [isHsr, charLevel]
  );
  const breakthroughMaterials = useMemo(
    () => isHsr ? [] : calculateBreakthroughMaterials(charLevel),
    [isHsr, charLevel]
  );

  // Talent costs (Genshin)
  const talentCosts = activeTalent?.costs;
  const talent1Materials = useMemo(
    () => calculateTalentMaterials(talentCosts, talent1Level),
    [talentCosts, talent1Level]
  );
  const talent2Materials = useMemo(
    () => calculateTalentMaterials(talentCosts, talent2Level),
    [talentCosts, talent2Level]
  );
  const talent3Materials = useMemo(
    () => calculateTalentMaterials(talentCosts, talent3Level),
    [talentCosts, talent3Level]
  );

  // Trace costs (HSR) — costs is { basicAtk: { lvl2: [...] }, skill: {...}, ... }
  const hsrBasicMaterials = useMemo(() => {
    if (!isHsr) return [];
    const c = activeTrace?.costs;
    return calculateTalentMaterials(c?.basicAtk, hsrBasicLevel);
  }, [isHsr, activeTrace, hsrBasicLevel]);
  const hsrSkillMaterials = useMemo(() => {
    if (!isHsr) return [];
    const c = activeTrace?.costs;
    return calculateTalentMaterials(c?.skill, hsrSkillLevel);
  }, [isHsr, activeTrace, hsrSkillLevel]);
  const hsrUltMaterials = useMemo(() => {
    if (!isHsr) return [];
    const c = activeTrace?.costs;
    return calculateTalentMaterials(c?.ultimate, hsrUltLevel);
  }, [isHsr, activeTrace, hsrUltLevel]);
  const hsrTalentMaterials = useMemo(() => {
    if (!isHsr) return [];
    const c = activeTrace?.costs;
    return calculateTalentMaterials(c?.talent, hsrTalentLevel);
  }, [isHsr, activeTrace, hsrTalentLevel]);
  const hsrTechMaterials = useMemo(() => {
    if (!isHsr) return [];
    const c = activeTrace?.costs;
    return calculateTalentMaterials(c?.technique, hsrTechLevel);
  }, [isHsr, activeTrace, hsrTechLevel]);

  const elationMaterials = useMemo(() => {
    if (!isHsr || !activeTrace?.elation) return [];
    return calculateTalentMaterials(activeTrace.costs?.elation, elationLevel);
  }, [isHsr, activeTrace, elationLevel]);

  const memospriteGroupMaterials = useMemo(() => {
    if (!isHsr || !activeTrace?.memospriteGroups) return [];
    return activeTrace.memospriteGroups.map((group, idx) =>
      calculateTalentMaterials(group.costs, memospriteGroupLevels[idx] ?? 10)
    );
  }, [isHsr, activeTrace, memospriteGroupLevels]);

  const totalMaterials = useMemo(
    () => isHsr
      ? mergeAllMaterials(
          ascensionMaterials,
          hsrBasicMaterials,
          hsrSkillMaterials,
          hsrUltMaterials,
          hsrTalentMaterials,
          hsrTechMaterials,
          elationMaterials,
          ...memospriteGroupMaterials,
        )
      : mergeAllMaterials(
          ascensionMaterials,
          expMaterials,
          breakthroughMaterials,
          talent1Materials,
          talent2Materials,
          talent3Materials,
        ),
    [isHsr, ascensionMaterials, expMaterials, breakthroughMaterials,
     talent1Materials, talent2Materials, talent3Materials,
     hsrBasicMaterials, hsrSkillMaterials, hsrUltMaterials, hsrTalentMaterials, hsrTechMaterials,
     elationMaterials, memospriteGroupMaterials]
  );

  if (charLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[480px] w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (charError || !character) {
    return (
      <div className="space-y-4">
        <Link to={`/${game}/characters`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {charError ?? "Character not found"}
        </div>
      </div>
    );
  }

  const displayElement = (isTraveler || isTrailblazer) ? (activeElement ?? character.element) : character.element;
  const elementColorMap = isHsr ? HSR_ELEMENT_COLOR_MAP : ELEMENT_COLOR_MAP;
  const elementClass = elementColorMap[displayElement ?? ""] ?? "bg-muted";

  const tabTraces = isHsr ? "traces" : "talents";
  const tabEidolons = isHsr ? "eidolons" : "constellations";

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link to={`/${game}/characters`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" /> Characters
        </Button>
      </Link>

      {/* Header */}
      <div className="relative">
        <Card className={`overflow-hidden aspect-[2/1] ${elementClass}/20`}>
          <ImageWithFallback
            src={characterSplashUrl(character.images) ?? characterIconUrl(character.images)}
            alt={character.name}
            className="w-full h-full object-contain"
          />
        </Card>

        {/* Info panel */}
        <div className="mt-6 md:mt-0 md:absolute md:inset-y-0 md:right-0 md:w-[42%] md:flex md:flex-col md:justify-center md:p-6">
          <div className="space-y-4 md:bg-background/90 md:backdrop-blur-sm md:rounded-xl md:p-5 md:border md:border-white/10">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold">{character.name}</h1>
              <Badge className={`${elementClass} border-0 text-white flex items-center gap-1`}>
                {isHsr
                  ? hsrElementIconUrl(displayElement) && <img src={hsrElementIconUrl(displayElement)!} className="h-4 w-4" alt="" />
                  : elementIconUrl(displayElement) && <img src={elementIconUrl(displayElement)!} className="h-4 w-4" alt="" />
                }
                {displayElement}
              </Badge>
            </div>
            {character.title && (
              <p className="mt-1 text-muted-foreground">{character.title}</p>
            )}
          </div>

          <RarityStars rarity={character.rarity} className="text-lg" />

          <div className="grid grid-cols-2 gap-3 text-sm">
            {isHsr ? (
              character.path && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Path: </span>
                  {hsrPathIconUrl(character.path) && (
                    <img src={hsrPathIconUrl(character.path)!} className="h-4 w-4" alt="" />
                  )}
                  {character.path}
                </div>
              )
            ) : (
              <>
                {character.weaponType && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Weapon: </span>
                    {weaponTypeIconUrl(character.weaponType) && (
                      <img src={weaponTypeIconUrl(character.weaponType)!} className="h-4 w-4" alt="" />
                    )}
                    {character.weaponType}
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Region: </span>
                  {resolveRegion(character.region, character.name)}
                </div>
              </>
            )}
            {character.substatText && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Asc. Stat: </span>
                <span className="flex items-center gap-1">
                  <StatIcon substatType={character.substatType} className="h-3.5 w-3.5 opacity-70 shrink-0" />
                  {character.substatText}
                </span>
              </div>
            )}
            {character.affiliation && (
              <div>
                <span className="text-muted-foreground">Affiliation: </span>
                {character.affiliation}
              </div>
            )}
            {character.constellation && (
              <div>
                <span className="text-muted-foreground">Constellation: </span>
                {character.constellation}
              </div>
            )}
            {character.birthday && (
              <div>
                <span className="text-muted-foreground">Birthday: </span>
                {character.birthday}
              </div>
            )}
            {character.version && (
              <div>
                <span className="text-muted-foreground">Version: </span>
                {character.version}
              </div>
            )}
          </div>

          {character.cv && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Voice Actors</p>
              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                {character.cv.english && <span>EN: {character.cv.english}</span>}
                {character.cv.japanese && <span>JP: {character.cv.japanese}</span>}
                {character.cv.chinese && <span>CN: {character.cv.chinese}</span>}
                {character.cv.korean && <span>KR: {character.cv.korean}</span>}
              </div>
            </div>
          )}

          {character.description && (
            <p className="text-sm text-muted-foreground">
              {character.description}
            </p>
          )}
          </div>
        </div>
      </div>

      {/* Element/path selector for multi-element characters */}
      {character.availableElements && character.availableElements.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">{isHsr ? "Path:" : "Element:"}</span>
          {character.availableElements.map((el) => {
            const elClass = elementColorMap[el] ?? "bg-muted";
            const isActive = activeElement === el;
            return (
              <button
                key={el}
                onClick={() => setActiveElement(el)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-all
                  ${isActive
                    ? `${elClass} text-white ring-2 ring-white/60 ring-offset-2 ring-offset-background`
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
              >
                {isHsr
                  ? hsrElementIconUrl(el) && <img src={hsrElementIconUrl(el)!} className="h-4 w-4" alt="" />
                  : elementIconUrl(el) && <img src={elementIconUrl(el)!} className="h-4 w-4" alt="" />
                }
                {el}
              </button>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue={tabTraces}>
        <TabsList>
          <TabsTrigger value={tabTraces}>
            {isHsr ? "Traces" : "Talents"}
          </TabsTrigger>
          <TabsTrigger value={tabEidolons}>
            {isHsr ? "Eidolons" : "Constellations"}
          </TabsTrigger>
          <TabsTrigger value="ascension">Ascension</TabsTrigger>
        </TabsList>

        {/* Talents tab (Genshin) */}
        {!isHsr && (
          <TabsContent value="talents">
            <div className="space-y-6">
              {activeTalent?.combat1 && (
                <Card>
                  <CardContent className="p-4">
                    <TalentSection
                      talent={activeTalent.combat1}
                      level={talent1Level}
                      onLevelChange={setTalent1Level}
                      iconUrl={talentIconUrl(activeTalentImages, "combat1")}
                    />
                    {activeTalent.hexerei?.combat1 && <HexereiBlock text={activeTalent.hexerei.combat1} />}
                  </CardContent>
                </Card>
              )}
              {activeTalent?.combat2 && (
                <Card>
                  <CardContent className="p-4">
                    <TalentSection
                      talent={activeTalent.combat2}
                      level={talent2Level}
                      onLevelChange={setTalent2Level}
                      iconUrl={talentIconUrl(activeTalentImages, "combat2")}
                    />
                    {activeTalent.hexerei?.combat2 && <HexereiBlock text={activeTalent.hexerei.combat2} />}
                  </CardContent>
                </Card>
              )}
              {activeTalent?.combat3 && (
                <Card>
                  <CardContent className="p-4">
                    <TalentSection
                      talent={activeTalent.combat3}
                      level={talent3Level}
                      onLevelChange={setTalent3Level}
                      iconUrl={talentIconUrl(activeTalentImages, "combat3")}
                    />
                    {activeTalent.hexerei?.combat3 && <HexereiBlock text={activeTalent.hexerei.combat3} />}
                  </CardContent>
                </Card>
              )}
              {activeTalent?.combatsp && (
                <Card>
                  <CardContent className="p-4">
                    <TalentSection
                      talent={activeTalent.combatsp}
                      level={1}
                      onLevelChange={() => {}}
                      iconUrl={talentIconUrl(activeTalentImages, "combatsp")}
                    />
                    {activeTalent.hexerei?.combatsp && <HexereiBlock text={activeTalent.hexerei.combatsp} />}
                  </CardContent>
                </Card>
              )}
              {(activeTalent?.passive1 || activeTalent?.passive2 || activeTalent?.passive3) && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Passive Talents</h3>
                  {(
                    [
                      ["passive1", activeTalent?.passive1],
                      ["passive2", activeTalent?.passive2],
                      ["passive3", activeTalent?.passive3],
                      ["passive4", activeTalent?.passive4],
                    ] as const
                  )
                    .filter(([, p]) => p != null)
                    .map(([key, passive]) => (
                      <Card key={key}>
                        <CardContent className="p-4">
                          <PassiveSection
                            passive={passive!}
                            iconUrl={talentIconUrl(activeTalentImages, key)}
                          />
                          {activeTalent?.hexerei?.[key] && <HexereiBlock text={activeTalent.hexerei[key]} />}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* Traces tab (HSR) */}
        {isHsr && (
          <TabsContent value="traces">
            <div className="space-y-4">
              {activeTrace && (
                (
                  [
                    { skill: activeTrace.basicAtk,  label: "Basic ATK", level: hsrBasicLevel, onLevelChange: setHsrBasicLevel, defaultMax: 10 },
                    { skill: activeTrace.skill,     label: "Skill",     level: hsrSkillLevel, onLevelChange: setHsrSkillLevel, defaultMax: 15 },
                    { skill: activeTrace.ultimate,  label: "Ultimate",  level: hsrUltLevel,   onLevelChange: setHsrUltLevel,   defaultMax: 15 },
                    { skill: activeTrace.talent,    label: "Talent",    level: hsrTalentLevel,onLevelChange: setHsrTalentLevel,defaultMax: 15 },
                    { skill: activeTrace.technique, label: "Technique", level: hsrTechLevel,  onLevelChange: setHsrTechLevel,  defaultMax: 15 },
                  ] as Array<{ skill: { name: string; maxLevel?: number; desc?: string; params?: number[][]; icon?: string } | null | undefined; label: string; level: number; onLevelChange: (v: number) => void; defaultMax: number }>
                )
                  .filter((e) => e.skill != null)
                  .map((e) => (
                    <Card key={e.label}>
                      <CardContent className="p-4">
                        <HsrSkillSection skill={e.skill!} label={e.label} level={e.level} onLevelChange={e.onLevelChange} defaultMax={e.defaultMax} />
                      </CardContent>
                    </Card>
                  ))
              )}
              {/* Elation Skill */}
              {activeTrace?.elation && (
                <Card>
                  <CardContent className="p-4">
                    <HsrSkillSection skill={activeTrace.elation} label="Elation" level={elationLevel} onLevelChange={setElationLevel} defaultMax={15} />
                  </CardContent>
                </Card>
              )}

              {/* Memosprite Groups — each group is one skill_tree node whose skills level together */}
              {activeTrace?.memospriteGroups?.map((group, idx) => {
                const effectiveMax = group.skills[0]?.maxLevel ?? 12;
                const level = Math.min(memospriteGroupLevels[idx] ?? 10, effectiveMax);
                return (
                  <Card key={`memospriteGroup_${idx}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Memosprite</Badge>
                          <span className="font-semibold text-sm">
                            {group.skills.length === 1
                              ? group.skills[0].name
                              : `${group.skills.length} Skills`}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">Lv. {level}</span>
                      </div>
                      <Slider
                        min={1}
                        max={effectiveMax}
                        step={1}
                        value={[level]}
                        onValueChange={([v]) => setMemospriteGroupLevels(prev => {
                          const next = [...prev]; next[idx] = v; return next;
                        })}
                      />
                      <div className="space-y-3 pt-1">
                        {group.skills.map((skill, si) => (
                          <div key={si} className={`flex gap-3 ${si > 0 ? "pt-3 border-t" : ""}`}>
                            {skill.icon && (
                              <img
                                src={skill.icon}
                                alt={skill.name}
                                className="h-8 w-8 rounded object-contain bg-muted/40 p-0.5 shrink-0 mt-0.5"
                              />
                            )}
                            <div>
                              <h5 className="font-medium text-sm">{skill.name}</h5>
                              {skill.desc && (
                                <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line">
                                  {parseHsrDesc(skill.desc, skill.params, level)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {activeTrace?.majorTraces && activeTrace.majorTraces.length > 0 && (
                <div className="space-y-3">
                  {activeTrace.majorTraces.map((trace, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          {trace.icon && (
                            <img
                              src={trace.icon}
                              alt={trace.name}
                              className="h-10 w-10 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0 mt-0.5"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              {trace.unlockPhase != null && (
                                <Badge variant="outline" className="text-xs">A{trace.unlockPhase}</Badge>
                              )}
                              <h4 className="font-semibold">{trace.name}</h4>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {parseHsrDesc(trace.desc ?? "", trace.params, 1)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {activeTrace?.statBonuses && activeTrace.statBonuses.length > 0 && (() => {
                const grouped = new Map<string, number>();
                for (const bonus of activeTrace.statBonuses) {
                  grouped.set(bonus.stat, (grouped.get(bonus.stat) ?? 0) + bonus.value);
                }
                return (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-3">Stat Bonuses</h4>
                      <div className="rounded-lg border">
                        <table className="w-full text-sm">
                          <tbody>
                            {Array.from(grouped.entries()).map(([stat, total]) => (
                              <tr key={stat} className="border-b last:border-0">
                                <td className="px-3 py-1.5 text-muted-foreground">
                                  <span className="flex items-center gap-1.5">
                                    {hsrStatIconUrl(stat) && (
                                      <img src={hsrStatIconUrl(stat)!} className="h-4 w-4 opacity-70 shrink-0" alt="" />
                                    )}
                                    {hsrStatName(stat)}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-amber-400">
                                  {total < 1
                                    ? `+${(total * 100).toFixed(1)}%`
                                    : `+${Number.isInteger(total) ? total : total.toFixed(1)}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          </TabsContent>
        )}

        {/* Constellations tab (Genshin) */}
        {!isHsr && (
          <TabsContent value="constellations">
            <div className="space-y-3">
              {activeConstellation &&
                (
                  [
                    ["c1", activeConstellation.c1],
                    ["c2", activeConstellation.c2],
                    ["c3", activeConstellation.c3],
                    ["c4", activeConstellation.c4],
                    ["c5", activeConstellation.c5],
                    ["c6", activeConstellation.c6],
                  ] as const
                ).map(([key, c]) =>
                  c ? (
                    <Card key={key}>
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          {(() => {
                            const iconUrl = constellationIconUrl(activeConstImages, key);
                            return iconUrl ? (
                              <img
                                src={iconUrl}
                                alt={c.name}
                                className="h-10 w-10 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0"
                              />
                            ) : null;
                          })()}
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{key.toUpperCase()}</Badge>
                              <h4 className="font-semibold">{c.name}</h4>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {renderMarkdownText(c.description)}
                            </p>
                          </div>
                        </div>
                        {activeConstellation?.hexerei?.[key] && (
                          <HexereiBlock text={activeConstellation.hexerei[key]} />
                        )}
                      </CardContent>
                    </Card>
                  ) : null
                )}
            </div>
          </TabsContent>
        )}

        {/* Eidolons tab (HSR) */}
        {isHsr && (
          <TabsContent value="eidolons">
            <div className="space-y-3">
              {activeEidolon &&
                (
                  [
                    ["e1", activeEidolon.e1],
                    ["e2", activeEidolon.e2],
                    ["e3", activeEidolon.e3],
                    ["e4", activeEidolon.e4],
                    ["e5", activeEidolon.e5],
                    ["e6", activeEidolon.e6],
                  ] as const
                ).map(([key, e]) =>
                  e ? (
                    <Card key={key}>
                      <CardContent className="p-4">
                        <div className="flex gap-3">
                          {activeEidolon.images?.[key] && (
                            <img
                              src={activeEidolon.images![key]}
                              alt={e.name}
                              className="h-10 w-10 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{key.toUpperCase()}</Badge>
                              <h4 className="font-semibold">{e.name}</h4>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {renderMarkdownText(e.description)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null
                )}
            </div>
          </TabsContent>
        )}

        {/* Ascension tab */}
        <TabsContent value="ascension">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Character Level</h3>
                <span className="text-sm text-muted-foreground">
                  Lv. {charLevel}{charLevel <= (isHsr ? 80 : 90) ? ` (Phase ${ascensionPhase})` : " (Breakthrough)"}
                </span>
              </div>
              <Slider
                min={1}
                max={isHsr ? 80 : 90}
                step={1}
                value={[charLevel > (isHsr ? 80 : 90) ? (isHsr ? 80 : 90) : charLevel]}
                onValueChange={([v]) => setCharLevel(v)}
                disabled={charLevel > (isHsr ? 80 : 90)}
              />
              {/* Ascension quick-jump buttons */}
              <div className="flex justify-between text-xs text-muted-foreground">
                {ascLevels.map((l) => (
                  <button
                    key={l}
                    className={`px-1 ${charLevel === l ? "text-primary font-bold" : ""}`}
                    onClick={() => setCharLevel(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {/* Breakthrough levels — Genshin only */}
              {!isHsr && (
                <div className="flex items-center gap-2 pt-1 border-t">
                  <span className="text-xs text-muted-foreground shrink-0">Breakthrough</span>
                  {([95, 100] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setCharLevel(charLevel === l ? 90 : l)}
                      className={`px-3 py-0.5 rounded text-xs border transition-colors ${
                        charLevel === l
                          ? "border-amber-400 text-amber-400 font-bold bg-amber-400/10"
                          : "border-muted-foreground/30 text-muted-foreground hover:border-amber-400/60 hover:text-amber-400"
                      }`}
                    >
                      Lv. {l}
                    </button>
                  ))}
                </div>
              )}
              {character.stats?.[charLevel] && (() => {
                const s = character.stats![charLevel];
                const rows = [
                  { label: "HP",  statType: "FIGHT_PROP_HP",     value: Math.round(s.hp).toLocaleString() },
                  { label: "ATK", statType: "FIGHT_PROP_ATTACK", value: Math.round(s.atk).toLocaleString() },
                  { label: "DEF", statType: "FIGHT_PROP_DEFENSE",value: Math.round(s.def).toLocaleString() },
                ];
                if (isHsr && (s as Record<string, number>).spd != null) {
                  rows.push({ label: "SPD", statType: "Speed", value: Math.round((s as Record<string, number>).spd).toString() });
                } else if (!isHsr && character.substatText) {
                  rows.push({
                    label: character.substatText,
                    statType: character.substatType ?? "",
                    value: formatSpecialized(s.specialized, character.substatType),
                  });
                }
                return (
                  <div className="rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="px-3 py-2 text-left font-medium" colSpan={2}>
                            Base Stats at Lv. {charLevel}
                          </th>
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
                            <td className="px-3 py-1.5 text-right font-mono font-semibold">
                              {value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              <MaterialCostTable materials={mergeAllMaterials(ascensionMaterials, expMaterials, breakthroughMaterials)} isHsr={isHsr} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Total Cost Calculator */}
      <TotalCostCalculator
        ascensionMaterials={mergeAllMaterials(ascensionMaterials, expMaterials, breakthroughMaterials)}
        skillSections={isHsr
          ? [
              { label: "Basic ATK", materials: hsrBasicMaterials,  level: hsrBasicLevel   },
              { label: "Skill",     materials: hsrSkillMaterials,   level: hsrSkillLevel   },
              { label: "Ultimate",  materials: hsrUltMaterials,     level: hsrUltLevel     },
              { label: "Talent",    materials: hsrTalentMaterials,  level: hsrTalentLevel  },
              { label: "Technique", materials: hsrTechMaterials,    level: hsrTechLevel    },
              ...(activeTrace?.elation ? [{ label: "Elation", materials: elationMaterials, level: elationLevel }] : []),
              ...memospriteGroupMaterials.map((mats, i) => ({
                label: activeTrace?.memospriteGroups?.[i]?.skills?.[0]?.name ?? `Memosprite ${i + 1}`,
                materials: mats,
                level: memospriteGroupLevels[i] ?? 10,
              })),
            ]
          : [
              { label: "Combat 1", materials: talent1Materials, level: talent1Level },
              { label: "Combat 2", materials: talent2Materials, level: talent2Level },
              { label: "Combat 3", materials: talent3Materials, level: talent3Level },
            ]
        }
        skillsLabel={isHsr ? "Traces" : "Talents"}
        totalMaterials={totalMaterials}
        charLevel={charLevel}
        isHsr={isHsr}
      />
    </div>
  );
}
