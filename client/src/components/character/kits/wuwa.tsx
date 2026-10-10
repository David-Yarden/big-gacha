import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getForte, getResonanceChain } from "@/lib/api";
import { wuwaForteSkillIconUrl, wuwaStatName } from "@/lib/images";
import { calculateTalentMaterials } from "@/lib/materials";
import { WUWA_FORTE_SKILLS, WUWA_FORTE_SKILL_LABELS } from "@/lib/constants";
import type { Forte, ForteSkill, ResonanceChain } from "@/lib/types";
import {
  StatBonusTable,
  NumberedEntryCard,
  renderMarkdownText,
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

type ForteKey = (typeof WUWA_FORTE_SKILLS)[number];
// Displayed in this order; the Outro Skill has no level
const DISPLAY_KEYS = [...WUWA_FORTE_SKILLS, "outroSkill"] as const;

type ViewMode = "simple" | "detailed";
const VIEW_KEY = "wuwa-kit-view";

/** Remembered per browser; the simple view is the default. */
function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "detailed" ? "detailed" : "simple";
    } catch {
      return "simple";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      /* storage unavailable */
    }
  }, [mode]);
  return [mode, setMode];
}

/** **bold** and [[key:Name|iconUrl]] (keyboard/mouse prompts) in guide texts. */
function richText(text: string): ReactNode[] {
  return text.split(/(\[\[key:[^\]]+\]\])/g).flatMap((part, i) => {
    const key = part.match(/^\[\[key:([^|\]]*)\|([^\]]+)\]\]$/);
    if (key) {
      return [
        <img
          key={`k${i}`}
          src={key[2]}
          alt={key[1]}
          title={key[1]}
          className="mx-0.5 inline-block h-5 w-auto align-text-bottom"
        />,
      ];
    }
    return renderMarkdownText(part).map((n, j) => <span key={`t${i}-${j}`}>{n}</span>);
  });
}

function GuideList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
            <span>{richText(t)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The in-game "Skill Input" mini guide. */
function SkillGuide({ guide }: { guide: NonNullable<Forte["guide"]> }) {
  return (
    <Card className="border-primary/25 bg-primary/[0.04]">
      <CardContent className="space-y-5 p-5">
        <h3 className="text-lg font-semibold">How to play</h3>
        {guide.modes && guide.modes.length > 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {guide.modes.map((m) => (
              <div key={m.name} className="rounded-lg border border-white/[0.08] bg-background/40 p-3">
                <div className="flex items-center gap-2">
                  {m.icon && <img src={m.icon} alt="" className="h-6 w-6 object-contain" />}
                  <span className="font-semibold">{m.name}</span>
                </div>
                {m.desc && <p className="mt-1.5 text-sm text-muted-foreground">{richText(m.desc)}</p>}
              </div>
            ))}
          </div>
        )}
        <GuideList title="Features" items={guide.features} />
        <GuideList title="Forte Gauge" items={guide.forteGauge} />
        <GuideList title="Instructions" items={guide.instructions} />
      </CardContent>
    </Card>
  );
}

/** One WuWa skill: description, level slider and the multiplier table. */
function WuwaSkillSection({
  skill,
  label,
  level,
  onLevelChange,
  mode,
}: {
  skill: ForteSkill;
  label: string;
  level: number;
  onLevelChange: (v: number) => void;
  mode: ViewMode;
}) {
  if (mode === "simple") {
    const text = skill.resume || skill.desc;
    return (
      <div className="flex gap-3">
        {skill.icon && (
          <img
            src={wuwaForteSkillIconUrl(skill.icon) ?? skill.icon}
            alt=""
            className="mt-0.5 h-11 w-11 shrink-0 rounded-lg bg-muted/40 object-contain p-1"
            onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">{label}</Badge>
            <h4 className="font-semibold">{skill.name}</h4>
          </div>
          {text && <div className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{renderMarkdownText(text)}</div>}
        </div>
      </div>
    );
  }
  const max = skill.maxLevel ?? 1;
  const lvl = Math.min(level, max);
  const [open, setOpen] = useState(false);
  const attrs = skill.attributes ?? [];
  return (
    <div className="flex gap-3">
      {skill.icon && (
        <img
          src={wuwaForteSkillIconUrl(skill.icon) ?? skill.icon}
          alt=""
          className="h-11 w-11 shrink-0 rounded-lg bg-muted/40 object-contain p-1 mt-0.5"
          onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">{label}</Badge>
            <h4 className="font-semibold">{skill.name}</h4>
          </div>
          {max > 1 && <span className="text-sm text-muted-foreground">Lv. {lvl}</span>}
        </div>
        {max > 1 && (
          <div className="mt-2">
            <Slider min={1} max={max} step={1} value={[lvl]} onValueChange={([v]) => onLevelChange(v)} />
          </div>
        )}
        {skill.desc && (
          <div className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
            {open || skill.desc.length < 600 ? (
              renderMarkdownText(skill.desc)
            ) : (
              <>
                {renderMarkdownText(skill.desc.slice(0, 600).replace(/\s+\S*$/, ""))}…
              </>
            )}
            {skill.desc.length >= 600 && (
              <button onClick={() => setOpen((o) => !o)} className="ml-1 text-xs font-medium text-primary hover:underline">
                {open ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}
        {attrs.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <tbody>
                {attrs.map((a) => (
                  <tr key={a.name} className="border-b last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">{a.name}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-amber-400">{a.values[lvl - 1] ?? a.values[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
const CHAIN_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;

export function useWuwaKit({ game, name, activeElement }: KitArgs): CharacterKit {
  const [levels, setLevels] = useState<Record<ForteKey, number>>(
    () => Object.fromEntries(WUWA_FORTE_SKILLS.map((k) => [k, 10])) as Record<ForteKey, number>
  );

  const enh = useCharacterEnhancements(game, name);
  const [mode, setMode] = useViewMode();
  const { data: forteData } = useApiQuery(() => getForte(game, name), [game, name]);
  const { data: chainData } = useApiQuery(() => getResonanceChain(game, name), [game, name]);
  const forte = forteData?.data as Forte | undefined;
  const chain = chainData?.data as ResonanceChain | undefined;

  // Rover: kit depends on the selected element
  const forteVariant = forte?.isTraveler && activeElement ? (forte.elementVariants?.[activeElement] as Partial<Forte> | undefined) : null;
  const activeForte = (forteVariant ?? forte) as Forte | undefined;
  const chainVariant = chain?.isTraveler && activeElement ? (chain.elementVariants?.[activeElement] as Partial<ResonanceChain> | undefined) : null;
  const activeChain = (chainVariant ?? chain) as ResonanceChain | undefined;

  const costs = activeForte?.costs;
  const skillSections = useMemo(() => {
    const sections: SkillSection[] = WUWA_FORTE_SKILLS.map((key) => ({
      label: WUWA_FORTE_SKILL_LABELS[key],
      materials: calculateTalentMaterials(costs?.[key], levels[key]),
      level: levels[key],
    }));
    // Inherent skills and stat nodes of the forte tree: unlocked once
    const nodes = nodeCosts([activeForte?.inherentSkill1, activeForte?.inherentSkill2], activeForte?.statBonuses);
    if (nodes.length) sections.push({ label: "Inherent skills & stat nodes", materials: nodes });
    return sections;
  }, [costs, levels, activeForte]);

  const inherent = [activeForte?.inherentSkill1, activeForte?.inherentSkill2].filter(Boolean);

  const forteTab = (
    <div className="space-y-4">
      {activeForte && (
        // Stays under the navbar while scrolling through the kit
        <div className="sticky top-16 z-20 -mx-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-background/85 px-2 py-2 shadow-sm backdrop-blur-md">
          <div className="inline-flex rounded-lg bg-muted/60 p-1 text-sm" role="group" aria-label="Kit view">
            {(["simple", "detailed"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "simple" ? "Simple" : "Detailed"}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {mode === "simple" ? "In-game summaries" : "Full descriptions and multipliers"}
          </span>
        </div>
      )}
      {activeForte?.guide && <SkillGuide guide={activeForte.guide} />}
      {forte === undefined && !forteData && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {forteData && !activeForte && (
        <p className="text-sm text-muted-foreground">No forte data for this resonator yet.</p>
      )}
      {activeForte &&
        DISPLAY_KEYS.map((key) => {
          const skill = activeForte[key] as ForteSkill | undefined;
          if (!skill) return null;
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <WuwaSkillSection
                  skill={skill}
                  label={WUWA_FORTE_SKILL_LABELS[key]}
                  level={(levels as Record<string, number>)[key] ?? 1}
                  onLevelChange={(v) => setLevels((l) => ({ ...l, [key]: v }))}
                  mode={mode}
                />
                <EnhancementAdditions enh={enh} target={`forte.${key}`} />
              </CardContent>
            </Card>
          );
        })}

      {inherent.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Inherent Skills</h3>
          {inherent.map((skill, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  {skill!.icon && (
                    <img
                      src={wuwaForteSkillIconUrl(skill!.icon) ?? skill!.icon}
                      alt={skill!.name}
                      className="h-10 w-10 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0 mt-0.5"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      {skill!.unlockPhase != null && <Badge variant="outline" className="text-xs">Rank {skill!.unlockPhase}</Badge>}
                      <h4 className="font-semibold">{skill!.name}</h4>
                    </div>
                    {skill!.desc && (
                      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">{renderMarkdownText(skill!.desc)}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeForte?.statBonuses && <StatBonusTable bonuses={activeForte.statBonuses} statName={wuwaStatName} />}
    </div>
  );

  const chainTab = (
    <div className="space-y-3">
      {activeChain &&
        CHAIN_KEYS.map((key) => {
          const s = activeChain[key];
          if (!s) return null;
          return (
            <NumberedEntryCard
              key={key}
              tag={key.toUpperCase()}
              name={s.name}
              description={s.description}
              iconUrl={activeChain.images?.[key]}
            >
              <EnhancementAdditions enh={enh} target={`chain.${key}`} />
            </NumberedEntryCard>
          );
        })}
    </div>
  );

  return {
    tabs: [
      { value: "forte", label: "Forte", content: forteTab },
      { value: "resonancechain", label: "Resonance Chain", content: chainTab },
      { value: "build", label: "Build", content: <BuildTab game={game} name={name} /> },
    ],
    skillSections,
    skillsLabel: "Forte",
    controls: <EnhancementControls enh={enh} />,
  };
}
