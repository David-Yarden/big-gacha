/**
 * Farm planner: the characters you want to raise, from their current to their target
 * levels, and the materials still to farm once your inventory is counted.
 * One plan per game, saved on the server (GET/PUT /api/:game/plan) as you type.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Loader2, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { MaterialIcon, dedupeByPhase, dedupeRepeatedHalf, nodeCosts } from "@/components/character/shared";
import { useApiQuery } from "@/hooks/useApiQuery";
import { FarmPanel } from "@/components/planner/FarmPanel";
import { AccountImport, ACCOUNT_GAMES } from "@/components/planner/AccountImport";
import {
  getAgentKit, getCharacter, getCharacters, getForte, getLightCone, getLightCones, getPlan,
  getTalent, getTrace, getWeapon, getWeapons, savePlan, type Plan, type PlanEntry, type ShowcaseCharacter,
} from "@/lib/api";
import { gameUi } from "@/lib/gameUi";
import { lightConePreviewUrl, weaponIconUrl, wuwaWeaponIconUrl } from "@/lib/images";
import { ASCENSION_LEVELS, calculateAscensionMaterials, calculateTalentMaterials, expPotions, levelToAscensionPhase, mergeAllMaterials, type MaterialCostEntry } from "@/lib/materials";
import { keyName, t } from "@/lib/i18n";
import { registryGame } from "@/lib/registry";
import type { Character, Game } from "@/lib/types";

type Costs = Record<string, MaterialCostEntry[]>;
type Unit = { name: string; _name?: string; images?: Record<string, string>; rarity?: number; element?: string };

/** Highest skill level reachable with materials (without duplicate bonuses). */
const SKILL_MAX: Record<string, number> = { genshin: 10, hsr: 10, wuwa: 10, zzz: 12, endfield: 12 };
const HSR_LEVELS = [1, 20, 30, 40, 50, 60, 70, 80] as const;
const hsrPhase = (l: number) => (l <= 20 ? 0 : Math.min(6, Math.ceil((l - 20) / 10)));

// ── Level grids ──────────────────────────────────────────────────────────────

function characterLevels(game: Game): number[] {
  const ui = gameUi(game);
  return [...new Set([1, ...ui.ascensionLevels, ui.maxLevel, ...ui.breakthroughLevels])].sort((a, b) => a - b);
}

function weaponRules(game: Game) {
  if (game === "hsr") return { levels: [...HSR_LEVELS], max: 80, phase: hsrPhase };
  const ui = gameUi(game);
  const max = ui.weaponMaxLevel ?? 90;
  const levels = [...new Set([1, ...(ui.weaponAscensionLevels ?? ASCENSION_LEVELS), max])].sort((a, b) => a - b);
  return { levels, max, phase: ui.weaponLevelToPhase ?? levelToAscensionPhase };
}

// ── Costs ────────────────────────────────────────────────────────────────────

/** a − b per material (never below zero). */
function subtract(a: MaterialCostEntry[], b: MaterialCostEntry[]): MaterialCostEntry[] {
  const owned = new Map(b.map((m) => [m.name, m.count]));
  return a.map((m) => ({ ...m, count: m.count - (owned.get(m.name) ?? 0) })).filter((m) => m.count > 0);
}

const LVL_KEY = /^lvl\d+$/;
const isTable = (v: unknown): v is Costs =>
  !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).some((k) => LVL_KEY.test(k));
const tableMax = (table: Costs) => Math.max(...Object.keys(table).filter((k) => LVL_KEY.test(k)).map((k) => Number(k.slice(3))));

type KitData = {
  costs?: unknown;
  memospriteGroups?: Array<{ costs?: unknown }> | null;
  majorTraces?: Array<{ unlockPhase?: number; cost?: MaterialCostEntry[] }>;
  statBonuses?: Array<{ stat: string; value: number; cost?: MaterialCostEntry[] }>;
  inherentSkill1?: { cost?: MaterialCostEntry[] };
  inherentSkill2?: { cost?: MaterialCostEntry[] };
  attributes?: Array<{ cost?: MaterialCostEntry[] }>;
  elementVariants?: Record<string, KitData>;
};

/** The kit itself, or its first variant (Traveler / Trailblazer / Rover) when it has no data of its own. */
function activeKit(kit: unknown): KitData | undefined {
  const k = kit as KitData | undefined;
  if (!k) return k;
  const variant = Object.values(k.elementVariants ?? {})[0];
  return k.costs || !variant ? k : { ...k, ...variant };
}

/** The skill cost tables of a kit (Genshin: one table shared by the three combat talents; HSR: + memosprites). */
function skillTables(game: Game, kit: unknown): Costs[] {
  const k = activeKit(kit);
  const costs = k?.costs;
  if (!costs || typeof costs !== "object") return [];
  if (isTable(costs)) return game === "genshin" ? [costs, costs, costs] : [costs];
  const memos = (k?.memospriteGroups ?? []).map((g) => g?.costs).filter(isTable);
  return [...Object.values(costs as Record<string, unknown>).filter(isTable), ...memos];
}

/** Label of the one-time nodes of a game's kit (none for Genshin / ZZZ). */
const NODE_LABEL: Partial<Record<string, string>> = { hsr: "Trace nodes", wuwa: "Inherent skills & stat nodes", endfield: "Attribute nodes" };

/** One-time unlock costs: HSR major traces + stat nodes, WuWa inherent skills + stat nodes, Endfield attributes. */
function kitNodeCosts(kit: unknown): MaterialCostEntry[] {
  const k = activeKit(kit);
  if (!k) return [];
  return nodeCosts(
    dedupeByPhase(k.majorTraces, false),
    dedupeRepeatedHalf(k.statBonuses),
    [k.inherentSkill1, k.inherentSkill2],
    k.attributes
  );
}

function fetchKit(game: Game, name: string): Promise<unknown> {
  const get = { genshin: getTalent, hsr: getTrace, wuwa: getForte, zzz: getAgentKit, endfield: getAgentKit }[game as string];
  return get ? get(game, name).then((r) => r.data).catch(() => null) : Promise.resolve(null);
}

function characterCosts(character: Character | undefined): Costs | undefined {
  if (character?.costs) return character.costs;
  const variant = Object.values(character?.elementVariants ?? {})[0] as { costs?: Costs } | undefined;
  return variant?.costs;
}

function entryMaterials(game: Game, entry: PlanEntry, character?: Character, kit?: unknown, weapon?: Character) {
  const ui = gameUi(game);
  const costs = characterCosts(character);
  const phase = (l: number) => ui.levelToPhase(Math.min(l, ui.maxLevel));
  const level = mergeAllMaterials(
    subtract(calculateAscensionMaterials(costs, phase(entry.levelTo)), calculateAscensionMaterials(costs, phase(entry.levelFrom))),
    ui.levelMaterials(entry.levelTo, character, entry.levelFrom)
  );

  const skills = mergeAllMaterials(
    ...skillTables(game, kit).map((table) => {
      const max = tableMax(table);
      return subtract(
        calculateTalentMaterials(table, Math.min(entry.skillTo, max)),
        calculateTalentMaterials(table, Math.min(entry.skillFrom, max))
      );
    })
  );
  const nodes = entry.nodes === false ? [] : kitNodeCosts(kit);

  let weaponMats: MaterialCostEntry[] = [];
  if (weapon && entry.weapon) {
    const w = weaponRules(game);
    const from = entry.weaponFrom ?? 1;
    const to = entry.weaponTo ?? w.max;
    weaponMats = mergeAllMaterials(
      subtract(calculateAscensionMaterials(weapon.costs, w.phase(to)), calculateAscensionMaterials(weapon.costs, w.phase(from))),
      expPotions(to, weapon, from)
    );
  }
  return mergeAllMaterials(level, skills, nodes, weaponMats);
}

/** The level grid plus the entry's own values (imported levels such as 73 stay exact). */
function withValues(values: number[], ...extra: number[]): number[] {
  return [...new Set([...values, ...extra.filter((v) => Number.isFinite(v))])].sort((a, b) => a - b);
}

/** A plan entry starting from a showcase character's levels (targets kept, or the maximum). */
function fromShowcase(game: Game, s: ShowcaseCharacter, base?: PlanEntry): PlanEntry {
  const ui = gameUi(game);
  const w = weaponRules(game);
  const skillMax = SKILL_MAX[game] ?? 10;
  const levelFrom = Math.min(Math.max(1, s.level), ui.maxLevel + (ui.breakthroughLevels.length ? 10 : 0));
  const skillFrom = Math.min(Math.max(1, s.skill), skillMax);
  const e: PlanEntry = {
    ...(base ?? { character: s.character, levelTo: ui.maxLevel, skillTo: skillMax, weaponFrom: 1, weaponTo: w.max }),
    levelFrom,
    skillFrom,
  } as PlanEntry;
  if (s.nodesDone) e.nodes = false;
  e.levelTo = Math.max(e.levelTo ?? ui.maxLevel, levelFrom);
  e.skillTo = Math.max(e.skillTo ?? skillMax, skillFrom);
  if (s.weapon && (!e.weapon || e.weapon === s.weapon)) {
    const weaponFrom = Math.min(Math.max(1, s.weaponLevel ?? 1), w.max);
    e.weapon = s.weapon;
    e.weaponFrom = weaponFrom;
    e.weaponTo = Math.max(e.weaponTo ?? w.max, weaponFrom);
  }
  return e;
}

const invKey = (m: MaterialCostEntry) => (m.id ? String(m.id) : m.name);

// ── Page ─────────────────────────────────────────────────────────────────────

export function PlannerPage() {
  const { game = "genshin" } = useParams<{ game: string }>();
  return <Planner key={game} game={game as Game} />;
}

function Planner({ game }: { game: Game }) {
  const { data: planData, loading, error } = useApiQuery(() => getPlan(game), [game]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [costs, setCosts] = useState<Record<string, MaterialCostEntry[]>>({});
  const [hideDone, setHideDone] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (planData?.data) setPlan(planData.data);
  }, [planData]);

  // Save shortly after the last change
  useEffect(() => {
    if (!plan || !dirty.current) return;
    setSaveState("saving");
    const timer = setTimeout(() => {
      savePlan(game, plan)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 700);
    return () => clearTimeout(timer);
  }, [plan, game]);

  const update = (fn: (p: Plan) => Plan) => {
    dirty.current = true;
    setPlan((p) => (p ? fn(p) : p));
  };
  const setEntry = (i: number, patch: Partial<PlanEntry>) =>
    update((p) => ({ ...p, entries: p.entries.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));
  const removeEntry = (i: number) => update((p) => ({ ...p, entries: p.entries.filter((_, j) => j !== i) }));
  const setOwned = (key: string, n: number) => update((p) => ({ ...p, inventory: { ...p.inventory, [key]: n } }));

  const levels = useMemo(() => characterLevels(game), [game]);
  const addCharacter = (u: Unit) => {
    const name = keyName(u);
    if (plan?.entries.some((e) => e.character === name)) return;
    const w = weaponRules(game);
    update((p) => ({
      ...p,
      entries: [
        ...p.entries,
        { character: name, levelFrom: 1, levelTo: gameUi(game).maxLevel, skillFrom: 1, skillTo: SKILL_MAX[game] ?? 10, weaponFrom: 1, weaponTo: w.max },
      ],
    }));
  };

  // Showcase import (Enka.Network): planned characters start from their real levels
  const importUpdate = (found: ShowcaseCharacter[]) => {
    let changed = 0;
    update((p) => ({
      ...p,
      entries: p.entries.map((e) => {
        const s = found.find((f) => f.character === e.character);
        if (!s) return e;
        changed++;
        return fromShowcase(game, s, e);
      }),
    }));
    return found.length || changed;
  };
  const importAdd = (found: ShowcaseCharacter[]) =>
    update((p) => ({
      ...p,
      entries: [...p.entries, ...found.filter((s) => !p.entries.some((e) => e.character === s.character)).map((s) => fromShowcase(game, s))],
    }));

  const entries = plan?.entries ?? [];
  const totals = useMemo(
    () => mergeAllMaterials(...entries.map((e) => costs[e.character] ?? [])),
    [entries, costs]
  );
  const rows = totals.map((m) => {
    const owned = plan?.inventory[invKey(m)] ?? 0;
    return { mat: m, owned, missing: Math.max(0, m.count - owned) };
  });
  const doneCount = rows.filter((r) => r.missing === 0).length;
  const characterLabel = registryGame(game)?.resources.find((r) => r.kind === "characters")?.label ?? "Characters";

  if (loading || (!plan && !error)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (error || !plan) {
    return <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error ?? "Plan unavailable"}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Farm Planner</h1>
          <p className="text-sm text-muted-foreground">Pick who to raise and how far: the materials still to farm are counted below.</p>
        </div>
        <SaveBadge state={saveState} />
      </div>

      {ACCOUNT_GAMES.has(game) && (
        <AccountImport
          game={game}
          uid={plan.uid}
          planned={entries.map((e) => e.character)}
          onUpdate={importUpdate}
          onAdd={importAdd}
          onUid={(uid) => update((p) => ({ ...p, uid }))}
        />
      )}

      <UnitPicker game={game} kind="characters" placeholder={`${t("Add")} — ${t(characterLabel)}…`} exclude={entries.map((e) => e.character)} onPick={addCharacter} />

      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nothing planned yet: add a character above.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {entries.map((entry, i) => (
            <EntryCard
              key={entry.character}
              game={game}
              entry={entry}
              levels={levels}
              onChange={(patch) => setEntry(i, patch)}
              onRemove={() => removeEntry(i)}
              onCosts={(mats) => setCosts((c) => ({ ...c, [entry.character]: mats }))}
            />
          ))}
        </div>
      )}

      <FarmPanel game={game} rows={rows} />

      {totals.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">To farm</h2>
                <p className="text-xs text-muted-foreground">{`${doneCount} / ${rows.length} materials complete`}</p>
              </div>
              <Toggle on={hideDone} onChange={setHideDone} label="Hide completed" />
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Material</th>
                    <th className="px-3 py-2 text-right font-medium">Needed</th>
                    <th className="px-3 py-2 text-right font-medium">Owned</th>
                    <th className="px-3 py-2 text-right font-medium">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((r) => !hideDone || r.missing > 0)
                    .map(({ mat, owned, missing }) => (
                      <tr key={mat.name} className={`border-b last:border-0 ${missing === 0 ? "opacity-50" : ""}`}>
                        <td className="px-3 py-1.5">
                          <Link to={`/${game}/materials/${encodeURIComponent(mat.name)}`} className="flex items-center gap-2 hover:underline">
                            <MaterialIcon mat={mat} game={game} />
                            <span className="min-w-0">{mat.name}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">{mat.count.toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-right">
                          <Stepper
                            value={owned}
                            onChange={(n) => setOwned(invKey(mat), n)}
                            label={`Owned: ${mat.name}`}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold">
                          {missing === 0 ? <Check className="ml-auto h-4 w-4 text-emerald-400" /> : missing.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Pill switch in the site's chip style. */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        on ? "border-primary/50 bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50"}`}>
        {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

/** Number field with − / + buttons in the site's style (Shift: ±10). */
function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const set = (n: number) => onChange(Math.max(0, Math.floor(n) || 0));
  const btn = "flex h-full w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="ml-auto inline-flex h-8 items-stretch overflow-hidden rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
      <button type="button" className={btn} disabled={value <= 0} onClick={(e) => set(value - (e.shiftKey ? 10 : 1))} aria-label="Less" title="Less">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value ? value.toLocaleString() : ""}
        placeholder="0"
        onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")))}
        onFocus={(e) => e.target.select()}
        className="w-20 border-x bg-transparent px-2 text-right font-mono text-sm outline-none placeholder:text-muted-foreground/50"
        aria-label={label}
      />
      <button type="button" className={btn} onClick={(e) => set(value + (e.shiftKey ? 10 : 1))} aria-label="More" title="More">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SaveBadge({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return <span className="text-xs text-muted-foreground">Saved automatically</span>;
  if (state === "saving") return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Saving…</span>;
  if (state === "error") return <span className="text-xs text-destructive">Not saved — server unreachable</span>;
  return <span className="flex items-center gap-1 text-xs text-emerald-400"><Check className="h-3 w-3" />Saved</span>;
}

// ── One planned character ────────────────────────────────────────────────────

function EntryCard({
  game, entry, levels, onChange, onRemove, onCosts,
}: {
  game: Game;
  entry: PlanEntry;
  levels: number[];
  onChange: (patch: Partial<PlanEntry>) => void;
  onRemove: () => void;
  onCosts: (mats: MaterialCostEntry[]) => void;
}) {
  const ui = gameUi(game);
  const { data: charData, error } = useApiQuery(() => getCharacter(game, entry.character), [game, entry.character]);
  const { data: kit } = useApiQuery(() => fetchKit(game, entry.character), [game, entry.character]);
  const { data: weaponData } = useApiQuery(
    (): Promise<{ data?: unknown } | null> =>
      entry.weapon ? (game === "hsr" ? getLightCone : getWeapon)(game, entry.weapon).catch(() => null) : Promise.resolve(null),
    [game, entry.weapon]
  );
  const character = charData?.data;
  const weapon = weaponData?.data as Character | undefined;

  const materials = useMemo(
    () => (character ? entryMaterials(game, entry, character, kit ?? undefined, weapon) : []),
    [game, entry, character, kit, weapon]
  );
  // Report to the totals (the callback changes every render; the materials do not)
  const report = useRef(onCosts);
  report.current = onCosts;
  useEffect(() => report.current(materials), [materials]);

  const w = weaponRules(game);
  const skillMax = SKILL_MAX[game] ?? 10;
  const skillLevels = Array.from({ length: skillMax }, (_, i) => i + 1);
  const portrait = ui.portrait(character?.images);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Link to={`/${game}/characters/${encodeURIComponent(entry.character)}`} className="flex min-w-0 flex-1 items-center gap-3 hover:underline">
            <ImageWithFallback src={portrait} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-muted/40 object-cover object-top" />
            <span className="truncate font-semibold">{character?.name ?? entry.character}</span>
          </Link>
          <button onClick={onRemove} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove" title="Remove">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
          <span className="text-muted-foreground">Level</span>
          <Range
            values={withValues(levels, entry.levelFrom, entry.levelTo)}
            from={entry.levelFrom}
            to={entry.levelTo}
            onChange={(levelFrom, levelTo) => onChange({ levelFrom, levelTo })}
          />
          <span className="text-muted-foreground">Skills</span>
          <Range
            values={skillLevels}
            from={entry.skillFrom}
            to={entry.skillTo}
            onChange={(skillFrom, skillTo) => onChange({ skillFrom, skillTo })}
          />
          {NODE_LABEL[game] && (
            <>
              <span className="text-muted-foreground">{t("Nodes")}</span>
              <Toggle on={entry.nodes !== false} onChange={(on) => onChange({ nodes: on })} label={NODE_LABEL[game]!} />
            </>
          )}
          <span className="text-muted-foreground">{t(registryGame(game)?.resources.find((r) => r.kind === "weapons")?.label ?? "Weapon")}</span>
          {entry.weapon ? (
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="flex min-w-0 items-center gap-1.5">
                <ImageWithFallback src={weaponIcon(game, weapon?.images)} alt="" className="h-6 w-6 shrink-0 object-contain" />
                <span className="truncate">{weapon?.name ?? entry.weapon}</span>
                <button onClick={() => onChange({ weapon: undefined })} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Remove" title="Remove">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
              <Range
                values={withValues(w.levels, entry.weaponFrom ?? 1, entry.weaponTo ?? w.max)}
                from={entry.weaponFrom ?? 1}
                to={entry.weaponTo ?? w.max}
                onChange={(weaponFrom, weaponTo) => onChange({ weaponFrom, weaponTo })}
              />
            </div>
          ) : (
            <UnitPicker game={game} kind="weapons" compact placeholder={`${t("Add")}…`} onPick={(u) => onChange({ weapon: keyName(u), weaponFrom: 1, weaponTo: w.max })} />
          )}
        </div>

        {materials.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-t pt-3">
            {materials.map((m) => (
              <span key={m.name} title={m.name} className="flex items-center gap-1 rounded-md bg-muted/40 py-0.5 pl-0.5 pr-1.5 text-xs font-mono">
                <MaterialIcon mat={m} game={game} />
                {compact(m.count)}
              </span>
            ))}
          </div>
        ) : (
          character && <p className="border-t pt-3 text-xs text-muted-foreground">Nothing to farm for this range.</p>
        )}
      </CardContent>
    </Card>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString();
}

function weaponIcon(game: Game, images?: Record<string, string>) {
  if (game === "hsr") return lightConePreviewUrl(images);
  if (game === "wuwa") return wuwaWeaponIconUrl(images);
  return weaponIconUrl(images);
}

/** "from → to" pair of selects; moving one past the other drags it along. */
function Range({ values, from, to, onChange }: { values: number[]; from: number; to: number; onChange: (from: number, to: number) => void }) {
  const cls = "rounded-md border bg-background px-2 py-1 text-sm font-mono";
  return (
    <div className="flex items-center gap-2">
      <select className={cls} value={from} onChange={(e) => { const f = Number(e.target.value); onChange(f, Math.max(f, to)); }} aria-label="Current">
        {values.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <span className="text-muted-foreground">→</span>
      <select className={cls} value={to} onChange={(e) => { const v = Number(e.target.value); onChange(Math.min(from, v), v); }} aria-label="Target">
        {values.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );
}

// ── Search-and-pick box for characters / weapons ────────────────────────────

function UnitPicker({
  game, kind, placeholder, exclude = [], compact: small, onPick,
}: {
  game: Game;
  kind: "characters" | "weapons";
  placeholder: string;
  exclude?: string[];
  compact?: boolean;
  onPick: (u: Unit) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Unit[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const params = { search: query.trim() || undefined, limit: 12, fields: "name,images,rarity,element", sort: "-rarity,name" };
      const list = kind === "characters" ? getCharacters : game === "hsr" ? getLightCones : getWeapons;
      list(game, params)
        .then((r) => setResults(r.data as unknown as Unit[]))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, game, kind]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const ui = gameUi(game);
  const icon = (u: Unit) => (kind === "characters" ? ui.portrait(u.images) : weaponIcon(game, u.images));
  const shown = results.filter((u) => !exclude.includes(keyName(u)));

  return (
    <div ref={box} className={`relative ${small ? "w-full max-w-64" : "max-w-md"}`}>
      <div className="relative">
        {small ? <Plus className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /> : <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`w-full rounded-md border bg-background ${small ? "py-1 pl-7 pr-2 text-sm" : "py-2 pl-9 pr-3"}`}
        />
      </div>
      {open && shown.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
          {shown.map((u) => (
            <button
              key={u.name}
              onClick={() => { onPick(u); setQuery(""); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <ImageWithFallback src={icon(u)} alt="" className="h-7 w-7 shrink-0 rounded object-cover object-top" />
              <span className="truncate">{u.name}</span>
              {u.rarity ? <span className="ml-auto text-xs text-amber-400">{u.rarity}★</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
