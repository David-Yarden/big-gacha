import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getAgentKit } from "@/lib/api";
import { calculateTalentMaterials } from "@/lib/materials";
import type { AgentKit, AgentSkill } from "@/lib/types";
import { GameText, NumberedEntryCard } from "@/components/character/shared";
import { BuildTab } from "@/components/character/BuildTab";
import type { CharacterKit, KitArgs } from "./types";

// In-game order of the skill page
const SKILL_KEYS = ["basic", "dodge", "assist", "special", "chain"] as const;
type SkillKey = (typeof SKILL_KEYS)[number];
const SKILL_LABELS: Record<SkillKey, string> = {
  basic: "Basic Attack",
  dodge: "Dodge",
  assist: "Assist",
  special: "Special Attack",
  chain: "Chain Attack",
};
const SKILL_MAX = 12; // without Mindscape bonuses

// In-game skill button icons
const KEY = "https://enka.network/ui/zzz/IconRoleSkillKey";
const SKILL_ICONS: Record<SkillKey | "core", string> = {
  basic: `${KEY}Normal.png`,
  dodge: `${KEY}Evade.png`,
  assist: `${KEY}Switch.png`,
  special: `${KEY}Special.png`,
  chain: `${KEY}Ultimate.png`,
  core: `${KEY}CoreSkill.png`,
};

function SkillIcon({ src }: { src: string }) {
  return <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-full bg-black object-contain p-0.5 ring-1 ring-white/10" />;
}
const CORE_LABELS = ["Base", "A", "B", "C", "D", "E", "F"];

function Text({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
      <GameText text={text} />
    </div>
  );
}

/** One skill category: its moves, a level slider and the multipliers grouped by move. */
function SkillCard({
  skill,
  label,
  icon,
  level,
  onLevelChange,
}: {
  skill: AgentSkill;
  label: string;
  icon: string;
  level: number;
  onLevelChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const max = skill.maxLevel || 16;
  const groups = useMemo(() => {
    const out: Array<{ group?: string; rows: AgentSkill["params"] }> = [];
    for (const p of skill.params ?? []) {
      const last = out[out.length - 1];
      if (last && last.group === p.group) last.rows.push(p);
      else out.push({ group: p.group, rows: [p] });
    }
    return out;
  }, [skill.params]);

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <SkillIcon src={icon} />
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">{label}</h3>
            <span className="text-xs text-muted-foreground">
              Lv. {level}
              {level > SKILL_MAX && <span className="ml-1 text-amber-400">(with Mindscapes)</span>}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {skill.entries.map((e) => (
            <div key={e.name}>
              <h4 className="font-semibold">{e.name}</h4>
              <div className="mt-1">
                <Text text={e.desc} />
              </div>
            </div>
          ))}
        </div>

        {groups.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Slider
                min={1}
                max={max}
                step={1}
                value={[level]}
                onValueChange={([v]) => onLevelChange(v)}
                className="flex-1"
                thumbIcon={icon}
                aria-label={`${label} level`}
              />
              <button onClick={() => setOpen((o) => !o)} className="shrink-0 text-xs font-medium text-primary hover:underline">
                {open ? "Hide multipliers" : "Show multipliers"}
              </button>
            </div>
            {open && (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <tbody>
                    {groups.map((g, gi) => (
                      <GroupRows key={gi} group={g.group} rows={g.rows} level={level} showTitle={groups.length > 1} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GroupRows({
  group,
  rows,
  level,
  showTitle,
}: {
  group?: string;
  rows: AgentSkill["params"];
  level: number;
  showTitle: boolean;
}) {
  return (
    <>
      {showTitle && group && (
        <tr className="border-b bg-muted/30">
          <td colSpan={2} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group}
          </td>
        </tr>
      )}
      {rows.map((p, i) => (
        <tr key={`${p.name}-${i}`} className="border-b last:border-0">
          <td className="px-3 py-1.5 text-muted-foreground">{p.name}</td>
          <td className="px-3 py-1.5 text-right font-mono text-amber-400">{p.values[level - 1] ?? p.values[0]}</td>
        </tr>
      ))}
    </>
  );
}

function CoreCard({ core, level, onLevelChange }: { core: NonNullable<AgentKit["core"]>; level: number; onLevelChange: (v: number) => void }) {
  const levels = core.levels ?? [];
  const current = levels.find((l) => l.level === level - 1) ?? levels[levels.length - 1];
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <SkillIcon src={SKILL_ICONS.core} />
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight">Core Skill</h3>
              <span className="text-xs text-muted-foreground">{core.name}</span>
            </div>
          </div>
          <div className="inline-flex rounded-lg bg-muted/60 p-1 text-xs" role="group" aria-label="Core Skill level">
            {levels.map((l) => (
              <button
                key={l.level}
                type="button"
                onClick={() => onLevelChange(l.level + 1)}
                aria-pressed={current?.level === l.level}
                title={l.unlockLevel ? `Agent level ${l.unlockLevel}` : undefined}
                className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  current?.level === l.level ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label ?? CORE_LABELS[l.level]}
              </button>
            ))}
          </div>
        </div>
        <Text text={current?.desc} />
        {current?.stats && current.stats.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {current.stats.map((st) => (
              <span key={st.name} className="rounded-md border border-white/[0.08] bg-muted/40 px-2 py-0.5 text-xs">
                {st.name} <span className="font-mono font-semibold text-amber-400">+{st.value}</span>
              </span>
            ))}
            {current.unlockLevel && <span className="self-center text-xs text-muted-foreground">from agent level {current.unlockLevel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** The game's recommended Drive Disc build ("Recommended" in the agent's equipment screen). */
export function useZzzKit({ game, name }: KitArgs): CharacterKit {
  const [levels, setLevels] = useState<Record<SkillKey, number>>(
    () => Object.fromEntries(SKILL_KEYS.map((k) => [k, SKILL_MAX])) as Record<SkillKey, number>
  );
  const [coreLevel, setCoreLevel] = useState(7);
  const { data } = useApiQuery(() => getAgentKit(game, name), [game, name]);
  const kit = data?.data as AgentKit | undefined;

  const skillSections = useMemo(
    () => [
      ...SKILL_KEYS.map((key) => ({
        label: SKILL_LABELS[key],
        materials: calculateTalentMaterials(kit?.costs?.[key], Math.min(levels[key], SKILL_MAX)),
        level: Math.min(levels[key], SKILL_MAX),
      })),
      {
        label: "Core Skill",
        materials: calculateTalentMaterials(kit?.costs?.core, coreLevel),
        level: coreLevel,
      },
    ],
    [kit?.costs, levels, coreLevel]
  );

  const skillsTab = (
    <div className="space-y-4">
      {!data && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && !kit && <p className="text-sm text-muted-foreground">No skill data for this agent yet.</p>}
      {kit &&
        SKILL_KEYS.map((key) => {
          const skill = kit.skills?.[key];
          if (!skill) return null;
          return (
            <SkillCard
              key={key}
              skill={skill}
              label={SKILL_LABELS[key]}
              icon={SKILL_ICONS[key]}
              level={levels[key]}
              onLevelChange={(v) => setLevels((l) => ({ ...l, [key]: v }))}
            />
          );
        })}
      {kit?.core && <CoreCard core={kit.core} level={coreLevel} onLevelChange={setCoreLevel} />}
      {kit?.core?.additional && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Additional Ability</Badge>
              <h4 className="font-semibold">{kit.core.additional.name}</h4>
            </div>
            <Text text={kit.core.additional.desc} />
          </CardContent>
        </Card>
      )}
    </div>
  );

  const mindscapeTab = (
    <div className="space-y-3">
      {(kit?.mindscapes ?? []).map((m) => (
        <NumberedEntryCard key={m.index} tag={`M${m.index}`} name={m.name} description={m.desc}>
          {m.flavor && <p className="mt-2 pl-0.5 text-xs italic leading-relaxed text-muted-foreground/70 whitespace-pre-line">{m.flavor}</p>}
        </NumberedEntryCard>
      ))}
    </div>
  );

  return {
    tabs: [
      { value: "skills", label: "Skills", content: skillsTab },
      { value: "mindscapes", label: "Mindscape Cinema", content: mindscapeTab },
      { value: "build", label: "Build", content: <BuildTab game={game} name={name} /> },
    ],
    skillSections,
    skillsLabel: "Skills",
  };
}
