/**
 * Arknights: Endfield operator kit: Basic Attack, Battle Skill, Combo Skill and Ultimate
 * (12 levels each, text and multipliers follow the level), talents, attribute nodes,
 * potentials, and the game's recommended weapons.
 */
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getAgentKit } from "@/lib/api";
import { calculateTalentMaterials } from "@/lib/materials";
import type { MaterialCostEntry } from "@/lib/materials";
import { GameText, NumberedEntryCard } from "@/components/character/shared";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { BuildTab } from "@/components/character/BuildTab";
import type { CharacterKit, KitArgs } from "./types";

const SKILL_KEYS = ["basic", "skill", "combo", "ultimate"] as const;
type SkillKey = (typeof SKILL_KEYS)[number];
const SKILL_LABELS: Record<SkillKey, string> = {
  basic: "Basic Attack",
  skill: "Battle Skill",
  combo: "Combo Skill",
  ultimate: "Ultimate",
};
const PROMOTIONS = ["", "Promotion I", "Promotion II", "Promotion III", "Promotion IV"];

interface EfSkill {
  name?: string;
  icon?: string;
  descs?: string[];
  params?: Array<{ name: string; values: string[] }>;
  cost?: number;
  cooldown?: number;
  maxLevel?: number;
}
interface EfKit {
  skills?: Partial<Record<SkillKey, EfSkill>>;
  talents?: Array<{ name?: string; icon?: string; ranks: Array<{ rank: number; promotion?: number; desc?: string }> }>;
  attributes?: Array<{ name?: string; desc?: string; promotion?: number; cost?: MaterialCostEntry[] }>;
  potentials?: Array<{ index: number; name?: string; desc?: string }>;
  costs?: Record<string, Record<string, MaterialCostEntry[]>>;
}

function Text({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
      <GameText text={text} />
    </div>
  );
}

function SkillIcon({ src }: { src?: string }) {
  return (
    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-black/60 p-1 ring-1 ring-white/10">
      <ImageWithFallback src={src ?? null} alt="" className="h-full w-full object-contain" />
    </span>
  );
}

function SkillCard({ skill, label, level, onLevelChange }: { skill: EfSkill; label: string; level: number; onLevelChange: (v: number) => void }) {
  const [open, setOpen] = useState(true);
  const max = skill.maxLevel || 1;
  const lv = Math.min(level, max);
  const desc = skill.descs?.[lv - 1] ?? skill.descs?.[0];
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <SkillIcon src={skill.icon} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold leading-tight">{skill.name}</h3>
              <Badge variant="outline" className="text-[10px]">{label}</Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Lv. {lv}
              {skill.cost ? ` · Cost ${skill.cost}` : ""}
              {skill.cooldown ? ` · Cooldown ${skill.cooldown}s` : ""}
            </span>
          </div>
        </div>
        <Text text={desc} />
        {max > 1 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Slider
                min={1}
                max={max}
                step={1}
                value={[lv]}
                onValueChange={([v]) => onLevelChange(v)}
                className="flex-1"
                thumbIcon={skill.icon}
                aria-label={`${label} level`}
              />
              {(skill.params?.length ?? 0) > 0 && (
                <button onClick={() => setOpen((o) => !o)} className="shrink-0 text-xs font-medium text-primary hover:underline">
                  {open ? "Hide multipliers" : "Show multipliers"}
                </button>
              )}
            </div>
            {open && (skill.params?.length ?? 0) > 0 && (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <tbody>
                    {skill.params!.map((p) => (
                      <tr key={p.name} className="border-b last:border-0">
                        <td className="px-3 py-1.5 text-muted-foreground">{p.name}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-amber-400">{p.values[lv - 1] || p.values[0]}</td>
                      </tr>
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

function TalentCard({ talent }: { talent: NonNullable<EfKit["talents"]>[number] }) {
  const ranks = talent.ranks ?? [];
  const [rank, setRank] = useState(ranks.length - 1);
  const current = ranks[Math.min(rank, ranks.length - 1)];
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <SkillIcon src={talent.icon} />
            <div>
              <h3 className="font-semibold leading-tight">{talent.name}</h3>
              <span className="text-xs text-muted-foreground">Talent</span>
            </div>
          </div>
          {ranks.length > 1 && (
            <div className="inline-flex rounded-lg bg-muted/60 p-1 text-xs" role="group" aria-label={`${talent.name} rank`}>
              {ranks.map((r, i) => (
                <button
                  key={r.rank}
                  type="button"
                  onClick={() => setRank(i)}
                  aria-pressed={i === rank}
                  title={r.promotion ? `Unlocked at ${PROMOTIONS[r.promotion]}` : undefined}
                  className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                    i === rank ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Rank {r.rank}
                </button>
              ))}
            </div>
          )}
        </div>
        <Text text={current?.desc} />
        {current?.promotion ? <p className="text-xs text-muted-foreground">Unlocked at {PROMOTIONS[current.promotion]}</p> : null}
      </CardContent>
    </Card>
  );
}

export function useEndfieldKit({ game, name }: KitArgs): CharacterKit {
  const { data } = useApiQuery(() => getAgentKit(game, name), [game, name]);
  const kit = data?.data as unknown as EfKit | undefined;
  const [levels, setLevels] = useState<Record<SkillKey, number>>({ basic: 12, skill: 12, combo: 12, ultimate: 12 });

  const skillSections = useMemo(
    () =>
      SKILL_KEYS.filter((k) => kit?.skills?.[k]).map((key) => ({
        label: SKILL_LABELS[key],
        materials: calculateTalentMaterials(kit?.costs?.[key], levels[key]),
        level: levels[key],
      })),
    [kit?.costs, kit?.skills, levels]
  );

  const skillsTab = (
    <div className="space-y-4">
      {!data && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && !kit && <p className="text-sm text-muted-foreground">No skill data for this operator yet.</p>}
      {SKILL_KEYS.map((key) => {
        const skill = kit?.skills?.[key];
        if (!skill) return null;
        return (
          <SkillCard
            key={key}
            skill={skill}
            label={SKILL_LABELS[key]}
            level={levels[key]}
            onLevelChange={(v) => setLevels((l) => ({ ...l, [key]: v }))}
          />
        );
      })}
    </div>
  );

  const talentsTab = (
    <div className="space-y-4">
      {(kit?.talents ?? []).map((t) => (
        <TalentCard key={t.name} talent={t} />
      ))}
      {(kit?.attributes ?? []).length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="font-semibold">Attribute nodes</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {kit!.attributes!.map((a, i) => (
                <div key={`${a.name}-${i}`} className="rounded-lg border border-white/[0.08] bg-muted/30 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{a.name}</span>
                    {a.promotion ? <span className="text-[10px] text-muted-foreground">{PROMOTIONS[a.promotion]}</span> : null}
                  </div>
                  <Text text={a.desc} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {kit && !kit.talents?.length && !kit.attributes?.length && <p className="text-sm text-muted-foreground">No talents.</p>}
    </div>
  );

  const potentialsTab = (
    <div className="space-y-3">
      {(kit?.potentials ?? []).map((p) => (
        <NumberedEntryCard key={p.index} tag={`P${p.index}`} name={p.name ?? ""} description={p.desc ?? ""} />
      ))}
    </div>
  );

  return {
    tabs: [
      { value: "skills", label: "Skills", content: skillsTab },
      { value: "talents", label: "Talents", content: talentsTab },
      { value: "potentials", label: "Potentials", content: potentialsTab },
      { value: "build", label: "Build", content: <BuildTab game={game} name={name} /> },
    ],
    skillSections,
    skillsLabel: "Skills",
  };
}
