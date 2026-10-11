/**
 * Chaos Zero Nightmare card customiser, like the deck builder sites: pick one of the card's
 * epiphanies, then a divine epiphany (by god) and a common epiphany. Which divine / common
 * epiphanies a card can get depends on the TYPE and COST of the chosen epiphany, so the
 * lists follow the selected epiphany; a choice that no longer fits is dropped.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { CardFace, GodSigil, GOD_COLOR, type CznCardData } from "@/components/czn/CardFace";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getReference } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface CardVariant extends CznCardData {
  /** 0 = the card without epiphany */
  level: number;
}

export interface Effect {
  id: string;
  text: string;
  types: string[];
  costs: string[];
  god?: string;
}
export interface EpiphanyTables {
  gods: string[];
  divine: Effect[];
  common: Effect[];
}

const ROMAN = ["", "I", "II", "III", "IV", "V"];
const costBracket = (cost: number) => (cost >= 4 ? "4+" : String(Math.max(0, cost)));
export const fits = (e: Effect, type?: string, cost?: number) =>
  (!e.types.length || (type != null && e.types.includes(type))) && (!e.costs.length || (cost != null && cost >= 0 && e.costs.includes(costBracket(cost))));
/** "Reduce Cost of this card by 1" → the card costs 1 less */
export const costDelta = (text?: string) => {
  const m = text?.match(/(?:Reduce|Decrease) (?:the )?Cost of this card by (\d+)/i);
  return m ? -Number(m[1]) : 0;
};
export const plain = (t: string) => t.replace(/\*\*([^*]+)\*\*/g, "[$1]");

/** The choices made on a card (what a deck keeps). */
export interface CardChoice {
  level: number;
  divineId: string | null;
  commonId: string | null;
}

/** The card as built: a variant with its divine and common epiphanies (null when they do not fit). */
export function builtCard(variants: CardVariant[], choice: Partial<CardChoice>, tables: EpiphanyTables | null) {
  const variant = variants.find((v) => v.level === (choice.level ?? 0)) ?? variants[0];
  const baseCost = variant.cost ?? 0;
  const divine = (tables?.divine ?? []).find((e) => e.id === choice.divineId && fits(e, variant.type, baseCost)) ?? null;
  const common = (tables?.common ?? []).find((e) => e.id === choice.commonId && fits(e, variant.type, baseCost)) ?? null;
  const cost = variant.cost == null ? undefined : Math.max(0, baseCost + costDelta(divine?.text) + costDelta(common?.text));
  return { variant, divine, common, cost };
}

export function useEpiphanyTables(game = "czn") {
  const { data } = useApiQuery(() => getReference(game as never, "Epiphanies"), [game]);
  return (data?.data?.data as EpiphanyTables | undefined) ?? null;
}

export function CardCustomizer({
  variants,
  attribute,
  initialLevel = 0,
  initial,
  onChange,
}: {
  variants: CardVariant[];
  attribute?: string;
  initialLevel?: number;
  /** Choices to start from (a deck's card) */
  initial?: Partial<CardChoice>;
  /** Called with the choices that fit, after each change */
  onChange?: (choice: CardChoice) => void;
}) {
  const tables = useEpiphanyTables();
  const [level, setLevel] = useState(initial?.level ?? initialLevel);
  const [god, setGod] = useState<string | null>(null);
  const [divineId, setDivineId] = useState<string | null>(initial?.divineId ?? null);
  const [commonId, setCommonId] = useState<string | null>(initial?.commonId ?? null);

  const variant = variants.find((v) => v.level === level) ?? variants[0];
  const baseCost = variant.cost ?? 0;

  // What this epiphany (type + cost) can receive
  const divineFor = useMemo(() => (tables?.divine ?? []).filter((e) => fits(e, variant.type, baseCost)), [tables, variant.type, baseCost]);
  const commonFor = useMemo(() => (tables?.common ?? []).filter((e) => fits(e, variant.type, baseCost)), [tables, variant.type, baseCost]);
  const perGod = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of divineFor) m.set(e.god ?? "", (m.get(e.god ?? "") ?? 0) + 1);
    return m;
  }, [divineFor]);

  // A choice made for another epiphany may not fit this one any more
  const divine = divineFor.find((e) => e.id === divineId) ?? null;
  const common = commonFor.find((e) => e.id === commonId) ?? null;
  const dropped = (divineId && !divine) || (commonId && !common);

  const cost = variant.cost == null ? undefined : Math.max(0, baseCost + costDelta(divine?.text) + costDelta(common?.text));

  // Report the choices that fit (not on the first render, nothing changed yet)
  const report = useRef(onChange);
  report.current = onChange;
  const first = useRef(true);
  const effectiveDivine = divine?.id ?? null;
  const effectiveCommon = common?.id ?? null;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    report.current?.({ level, divineId: effectiveDivine, commonId: effectiveCommon });
  }, [level, effectiveDivine, effectiveCommon]);

  const shownDivine = god ? divineFor.filter((e) => e.god === god) : divineFor;

  return (
    <div className="space-y-5">
      {/* Epiphanies of the card */}
      <div>
        <p className="mb-2 text-sm font-semibold">Epiphany</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {variants.map((v) => (
            <button
              key={v.level}
              type="button"
              onClick={() => setLevel(v.level)}
              className={cn("rounded-lg p-1 text-center transition", v.level === level ? "bg-primary/20 ring-2 ring-primary" : "opacity-75 hover:opacity-100")}
            >
              <CardFace card={v} attribute={attribute} epiphany={v.level > 0} />
              <span className="mt-1 block text-xs text-muted-foreground">{v.level ? `Epiphany ${ROMAN[v.level]}` : "Base"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        {/* The card as built */}
        <div className="space-y-2">
          <CardFace
            card={{ ...variant, cost }}
            attribute={attribute}
            epiphany={variant.level > 0}
            divine={divine ? { text: divine.text, god: divine.god } : undefined}
            extra={common ? [common.text] : undefined}
          />
          {dropped && <p className="text-xs text-amber-300">A choice did not fit this epiphany's type or cost and was removed.</p>}
          {(divine || common) && (
            <button type="button" onClick={() => (setDivineId(null), setCommonId(null))} className="text-xs text-primary hover:underline">
              Clear
            </button>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          {!tables && <p className="text-sm text-muted-foreground">Loading epiphanies…</p>}

          {tables && (
            <section className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">Divine Epiphany</p>
                <p className="text-xs text-muted-foreground">{`${divineFor.length} possible for a ${baseCost}-cost ${variant.type ?? "card"}`}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <GodChip label="All gods" active={!god} count={divineFor.length} onClick={() => setGod(null)} />
                {tables.gods.map((g) => (
                  <GodChip key={g} label={g} god={g} active={god === g} count={perGod.get(g) ?? 0} onClick={() => setGod(god === g ? null : g)} />
                ))}
              </div>
              <EffectList items={shownDivine} selected={divineId} onSelect={setDivineId} showGod={!god} />
            </section>
          )}

          {tables && commonFor.length > 0 && (
            <section className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">Common Epiphany</p>
                <p className="text-xs text-muted-foreground">{`${commonFor.length} possible`}</p>
              </div>
              <EffectList items={commonFor} selected={commonId} onSelect={setCommonId} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function GodChip({ label, god, active, count, onClick }: { label: string; god?: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!count}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-35",
        active ? "border-transparent bg-white/15" : "border-white/10 hover:bg-white/10"
      )}
      style={active && god ? { boxShadow: `inset 0 0 0 1px ${GOD_COLOR[god]}` } : undefined}
    >
      {god && <GodSigil god={god} className="h-4 w-4" />}
      {label}
      <span className="text-muted-foreground">{count}</span>
    </button>
  );
}

function EffectList({ items, selected, onSelect, showGod }: { items: Effect[]; selected: string | null; onSelect: (id: string | null) => void; showGod?: boolean }) {
  return (
    <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-1">
      {items.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => onSelect(selected === e.id ? null : e.id)}
            className={cn("flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm", selected === e.id ? "bg-primary/20" : "hover:bg-white/5")}
          >
            {e.god ? <GodSigil god={e.god} className="mt-0.5 h-4 w-4 shrink-0" /> : <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-white/40" />}
            <span className="flex-1">{plain(e.text)}</span>
            {showGod && e.god && <span className="shrink-0 text-xs text-muted-foreground">{e.god}</span>}
            {selected === e.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        </li>
      ))}
      {!items.length && <li className="px-2 py-3 text-sm text-muted-foreground">None for this epiphany.</li>}
    </ul>
  );
}
