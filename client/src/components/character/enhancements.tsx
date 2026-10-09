/**
 * Generic kit enhancements (Hexerei, Witch's Revelation, Novaflare, …) for every game.
 * Data comes from shared/games/<game>/enhancements/*.yaml through the API.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getEnhancements } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Enhancement, EnhancementColor, EnhancementText, EnhancementType, Game } from "@/lib/types";

// Literal class names so Tailwind generates them
const COLOR: Record<EnhancementColor, { block: string; title: string; text: string; chip: string; border: string }> = {
  violet:  { block: "border-violet-500/30 bg-violet-500/5",   title: "text-violet-400",  text: "text-violet-200/80",  chip: "bg-violet-500 text-white",  border: "border-violet-500/40" },
  amber:   { block: "border-amber-500/30 bg-amber-500/5",     title: "text-amber-400",   text: "text-amber-200/80",   chip: "bg-amber-500 text-white",   border: "border-amber-500/40" },
  sky:     { block: "border-sky-500/30 bg-sky-500/5",         title: "text-sky-400",     text: "text-sky-200/80",     chip: "bg-sky-500 text-white",     border: "border-sky-500/40" },
  emerald: { block: "border-emerald-500/30 bg-emerald-500/5", title: "text-emerald-400", text: "text-emerald-200/80", chip: "bg-emerald-500 text-white", border: "border-emerald-500/40" },
  rose:    { block: "border-rose-500/30 bg-rose-500/5",       title: "text-rose-400",    text: "text-rose-200/80",    chip: "bg-rose-500 text-white",    border: "border-rose-500/40" },
  orange:  { block: "border-orange-500/30 bg-orange-500/5",   title: "text-orange-400",  text: "text-orange-200/80",  chip: "bg-orange-500 text-white",  border: "border-orange-500/40" },
};

export function enhancementColor(type?: EnhancementType) {
  return COLOR[type?.color ?? "violet"] ?? COLOR.violet;
}

export interface CharacterEnhancements {
  types: EnhancementType[];
  /** Is a mechanic switched on in the view? (all on by default) */
  isActive: (typeId: string) => boolean;
  toggle: (typeId: string) => void;
  /** Addition entries for a target, from active mechanics */
  additions: (target: string) => Array<{ entry: Enhancement; type: EnhancementType }>;
  /** Base text with rework applied (enhanced when active, original otherwise) */
  rework: <T extends EnhancementText>(target: string, base: T) => T & { reworkedBy?: EnhancementType };
  /** At least one rework mechanic applies and is switched off → show the original kit */
  showingOriginal: boolean;
  hasRework: boolean;
}

export function useCharacterEnhancements(game: Game, name: string): CharacterEnhancements {
  const { data } = useApiQuery(() => getEnhancements(game, name), [game, name]);
  const [off, setOff] = useState<Set<string>>(new Set());

  return useMemo(() => {
    const types = data?.data.types ?? [];
    const entries = data?.data.entries ?? [];
    const typeById = new Map(types.map((t) => [t.id, t]));
    const isActive = (id: string) => !off.has(id);
    const toggle = (id: string) =>
      setOff((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });

    const additions = (target: string) =>
      entries
        .filter((e) => e.target === target && e.text && isActive(e.type) && typeById.get(e.type)?.kind === "addition")
        .map((entry) => ({ entry, type: typeById.get(entry.type)! }));

    const rework = <T extends EnhancementText>(target: string, base: T) => {
      const entry = entries.find((e) => e.target === target && typeById.get(e.type)?.kind === "rework");
      if (!entry) return base;
      const type = typeById.get(entry.type)!;
      if (isActive(entry.type)) {
        return entry.enhanced ? { ...base, ...entry.enhanced, reworkedBy: type } : base;
      }
      return entry.original ? { ...base, ...entry.original } : base;
    };

    const reworkTypes = types.filter((t) => t.kind === "rework");
    return {
      types,
      isActive,
      toggle,
      additions,
      rework,
      hasRework: reworkTypes.length > 0,
      showingOriginal: reworkTypes.some((t) => !isActive(t.id)),
    };
  }, [data, off]);
}

/** One switch per mechanic affecting the character. */
export function EnhancementControls({ enh }: { enh: CharacterEnhancements }) {
  if (enh.types.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Enhancements:</span>
      {enh.types.map((t) => {
        const on = enh.isActive(t.id);
        const c = enhancementColor(t);
        return (
          <button
            key={t.id}
            onClick={() => enh.toggle(t.id)}
            title={[t.description, t.condition && `Condition: ${t.condition}`].filter(Boolean).join("\n\n")}
            aria-pressed={on}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-all",
              on ? `${c.chip} ring-2 ring-white/50 ring-offset-2 ring-offset-background` : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {t.kind === "rework" && !on ? `Original (before ${t.name})` : t.name}
            {t.version && <span className="text-xs opacity-75">{t.version}</span>}
            {t.verified === false && <span className="text-xs opacity-75">· unverified</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Extra effect shown under the part of the kit it enhances. */
export function EnhancementBlock({ entry, type }: { entry: Enhancement; type: EnhancementType }) {
  const c = enhancementColor(type);
  return (
    <div className={cn("mt-3 rounded-md border px-3 py-2", c.block)}>
      <p className={cn("mb-1 flex items-center gap-2 text-xs font-semibold", c.title)}>
        {type.name}
        {type.verified === false && (
          <span className="font-normal opacity-80" title="Summary from community sources — exact values not verified">
            (summary, not verified)
          </span>
        )}
      </p>
      <p className={cn("text-sm whitespace-pre-line", c.text)}>{entry.text}</p>
      {entry.sources && entry.sources.length > 0 && (
        <p className="mt-1 text-xs opacity-60">
          {entry.sources.map((s, i) => (
            <a key={s} href={s} target="_blank" rel="noreferrer" className="underline hover:opacity-100">
              source{entry.sources!.length > 1 ? ` ${i + 1}` : ""}
            </a>
          )).reduce<ReactNode[]>((acc, el, i) => (i ? [...acc, " · ", el] : [el]), [])}
        </p>
      )}
    </div>
  );
}

/** All additions for a target, stacked. */
export function EnhancementAdditions({ enh, target }: { enh: CharacterEnhancements; target: string }) {
  const list = enh.additions(target);
  if (!list.length) return null;
  return (
    <>
      {list.map(({ entry, type }, i) => (
        <EnhancementBlock key={`${entry.type}-${i}`} entry={entry} type={type} />
      ))}
    </>
  );
}
