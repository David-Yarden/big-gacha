import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getTrace, getEidolon } from "@/lib/api";
import { hsrStatIconUrl, hsrStatName } from "@/lib/images";
import { calculateTalentMaterials } from "@/lib/materials";
import type { Trace, Eidolon, TraceSkill } from "@/lib/types";
import {
  HsrSkillSection,
  StatBonusTable,
  NumberedEntryCard,
  parseHsrDesc,
  dedupeByPhase,
  dedupeRepeatedHalf,
  nodeCosts,
} from "@/components/character/shared";
import {
  useCharacterEnhancements,
  EnhancementControls,
  EnhancementAdditions,
} from "@/components/character/enhancements";
import { BuildTab } from "@/components/character/BuildTab";
import type { CharacterKit, KitArgs } from "./types";
import type { SkillSection } from "@/components/character/TotalCostCalculator";

const SKILLS = [
  { key: "basicAtk",  label: "Basic ATK", defaultMax: 10, initial: 6 },
  { key: "skill",     label: "Skill",     defaultMax: 15, initial: 10 },
  { key: "ultimate",  label: "Ultimate",  defaultMax: 15, initial: 10 },
  { key: "talent",    label: "Talent",    defaultMax: 15, initial: 10 },
  { key: "technique", label: "Technique", defaultMax: 15, initial: 10 },
] as const;
type SkillKey = (typeof SKILLS)[number]["key"];

const EIDOLON_KEYS = ["e1", "e2", "e3", "e4", "e5", "e6"] as const;

export function useHsrKit({ game, name, activeElement }: KitArgs): CharacterKit {
  const [levels, setLevels] = useState<Record<SkillKey, number>>(
    () => Object.fromEntries(SKILLS.map((s) => [s.key, s.initial])) as Record<SkillKey, number>
  );
  const [elationLevel, setElationLevel] = useState(10);
  const [memoLevels, setMemoLevels] = useState<number[]>([]);
  const enh = useCharacterEnhancements(game, name);

  const { data: traceData } = useApiQuery(() => getTrace(game, name), [game, name]);
  const { data: eidolonData } = useApiQuery(() => getEidolon(game, name), [game, name]);
  const trace = traceData?.data as Trace | undefined;
  const eidolon = eidolonData?.data as Eidolon | undefined;

  // Character Enhancement: the documents hold the original kit and the enhanced one (game data);
  // the enhanced kit is shown unless the version toggle (rework mechanic) is on "original"
  const versioned = !!(trace?.enhanced || eidolon?.enhanced);
  const showEnhanced = versioned && !enh.showingOriginal;
  const reworkType = enh.types.find((t) => t.kind === "rework");

  // Trailblazer: kit depends on the selected path
  const traceVariant = trace?.isTraveler && activeElement ? (trace.elementVariants?.[activeElement] as Partial<Trace> | undefined) : null;
  // Memoised: a new object at each render would re-run the effects that depend on it
  const activeTrace = useMemo(
    () => (traceVariant ?? (showEnhanced && trace?.enhanced ? { ...trace, ...trace.enhanced } : trace)) as Trace | undefined,
    [traceVariant, showEnhanced, trace]
  );
  const eidolonVariant = eidolon?.isTraveler && activeElement ? (eidolon.elementVariants?.[activeElement] as Partial<Eidolon> | undefined) : null;
  const activeEidolon = useMemo(
    () => (eidolonVariant ?? (showEnhanced && eidolon?.enhanced ? { ...eidolon, ...eidolon.enhanced } : eidolon)) as Eidolon | undefined,
    [eidolonVariant, showEnhanced, eidolon]
  );

  useEffect(() => {
    setMemoLevels(activeTrace?.memospriteGroups?.map(() => 10) ?? []);
  }, [activeTrace]);

  // Older documents (before the split of the two trees): the source listed BOTH the original and
  // the new major traces / stat nodes (original first). Keep one copy, the one matching the view.
  const displayTrace = useMemo((): Trace | undefined => {
    if (!activeTrace) return activeTrace;
    const base = {
      ...activeTrace,
      majorTraces: dedupeByPhase(activeTrace.majorTraces, enh.showingOriginal),
      statBonuses: dedupeRepeatedHalf(activeTrace.statBonuses),
    };
    return base;
  }, [activeTrace, enh.showingOriginal]);

  const costs = activeTrace?.costs;
  const skillSections = useMemo(() => {
    const sections: SkillSection[] = SKILLS.map((s) => ({
      label: s.label,
      materials: calculateTalentMaterials(costs?.[s.key], levels[s.key]),
      level: levels[s.key],
    }));
    if (activeTrace?.elation) {
      sections.push({ label: "Elation", materials: calculateTalentMaterials(costs?.elation, elationLevel), level: elationLevel });
    }
    activeTrace?.memospriteGroups?.forEach((group, i) => {
      const level = memoLevels[i] ?? 10;
      sections.push({
        label: group.skills?.[0]?.name ?? `Memosprite ${i + 1}`,
        materials: calculateTalentMaterials(group.costs, level),
        level,
      });
    });
    // Major traces (A2/A4/A6) and stat bonus nodes: unlocked once
    const nodes = nodeCosts(displayTrace?.majorTraces, displayTrace?.statBonuses);
    if (nodes.length) sections.push({ label: "Trace nodes", materials: nodes });
    return sections;
  }, [costs, levels, activeTrace, displayTrace, elationLevel, memoLevels]);

  const tracesTab = (
    <div className="space-y-4">
      {displayTrace &&
        SKILLS.map((s) => {
          const skill = displayTrace[s.key] as TraceSkill | undefined;
          if (!skill) return null;
          return (
            <Card key={s.key}>
              <CardContent className="p-4">
                <HsrSkillSection
                  skill={skill}
                  label={s.label}
                  level={levels[s.key]}
                  onLevelChange={(v) => setLevels((l) => ({ ...l, [s.key]: v }))}
                  defaultMax={s.defaultMax}
                />
                <EnhancementAdditions enh={enh} target={`trace.${s.key}`} />
              </CardContent>
            </Card>
          );
        })}

      {activeTrace?.elation && (
        <Card>
          <CardContent className="p-4">
            <HsrSkillSection skill={activeTrace.elation} label="Elation" level={elationLevel} onLevelChange={setElationLevel} defaultMax={15} />
          </CardContent>
        </Card>
      )}

      {/* Memosprite groups — skills of one skill-tree node level together */}
      {activeTrace?.memospriteGroups?.map((group, idx) => {
        const effectiveMax = group.skills[0]?.maxLevel ?? 12;
        const level = Math.min(memoLevels[idx] ?? 10, effectiveMax);
        return (
          <Card key={`memo_${idx}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Memosprite</Badge>
                  <span className="font-semibold text-sm">
                    {group.skills.length === 1 ? group.skills[0].name : `${group.skills.length} Skills`}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">Lv. {level}</span>
              </div>
              <Slider
                min={1}
                max={effectiveMax}
                step={1}
                value={[level]}
                onValueChange={([v]) => setMemoLevels((prev) => {
                  const next = [...prev];
                  next[idx] = v;
                  return next;
                })}
              />
              <div className="space-y-3 pt-1">
                {group.skills.map((skill, si) => (
                  <div key={si} className={`flex gap-3 ${si > 0 ? "pt-3 border-t" : ""}`}>
                    {skill.icon && (
                      <img src={skill.icon} alt={skill.name} className="h-8 w-8 rounded object-contain bg-muted/40 p-0.5 shrink-0 mt-0.5" />
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

      {displayTrace?.majorTraces && displayTrace.majorTraces.length > 0 && (
        <div className="space-y-3">
          {displayTrace.majorTraces.map((t, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  {t.icon && (
                    <img src={t.icon} alt={t.name} className="h-10 w-10 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      {t.unlockPhase != null && <Badge variant="outline" className="text-xs">A{t.unlockPhase}</Badge>}
                      <h4 className="font-semibold">{t.name}</h4>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{parseHsrDesc(t.desc ?? "", t.params, 1)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {enh.additions("trace.extra").length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-semibold">Additional Trace</h4>
            <EnhancementAdditions enh={enh} target="trace.extra" />
          </CardContent>
        </Card>
      )}

      {displayTrace?.statBonuses && (
        <StatBonusTable bonuses={displayTrace.statBonuses} statName={hsrStatName} statIcon={hsrStatIconUrl} />
      )}
    </div>
  );

  const eidolonsTab = (
    <div className="space-y-3">
      {activeEidolon &&
        EIDOLON_KEYS.map((key) => {
          const e = activeEidolon[key];
          if (!e) return null;
          // Versioned by the game data: its own text, marked when the enhancement changed it
          const shown = versioned
            ? { name: e.name, description: e.description, reworkedBy: showEnhanced && eidolon?.enhanced?.[key] ? reworkType : undefined }
            : enh.rework(`eidolon.${key}`, { name: e.name, description: e.description });
          return (
            <NumberedEntryCard
              key={key}
              tag={key.toUpperCase()}
              name={shown.name ?? e.name}
              description={shown.description ?? e.description}
              iconUrl={activeEidolon.images?.[key]}
              highlight={shown.reworkedBy?.name}
            >
              <EnhancementAdditions enh={enh} target={`eidolon.${key}`} />
            </NumberedEntryCard>
          );
        })}
    </div>
  );

  return {
    tabs: [
      { value: "traces", label: "Traces", content: tracesTab },
      { value: "eidolons", label: "Eidolons", content: eidolonsTab },
      { value: "build", label: "Build", content: <BuildTab game={game} name={name} /> },
    ],
    skillSections,
    skillsLabel: "Traces",
    controls: <EnhancementControls enh={enh} />,
  };
}
