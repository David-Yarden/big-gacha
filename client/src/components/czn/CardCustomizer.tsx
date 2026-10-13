/**
 * Chaos Zero Nightmare card customiser, like the deck builder sites: pick one of the card's
 * epiphanies, then a divine epiphany (by god) and a common epiphany. Which divine / common
 * epiphanies a card can get depends on the TYPE and COST of the chosen epiphany, so the
 * lists follow the selected epiphany; a choice that no longer fits is dropped.
 * A card takes either one of its own epiphanies (I–V) or a common epiphany, never both; a
 * divine epiphany needs one of them (the game offers none on a card with no epiphany) and
 * combines with either. A combatant's basic cards (starting cards with no
 * epiphany of their own) take no epiphany at all.
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
  /** Classes that can get it (none: any class) */
  classes?: string[];
  /** What the card must do to be offered it: cure (heals), shield, draw, targetable (hits one chosen enemy) */
  requires?: string[];
  /** What the card must not do (a card that already draws gets no draw effect) */
  forbids?: string[];
  /** Divine epiphanies: cost range of the card (an X-cost card has neither) */
  minCost?: number;
  maxCost?: number;
  /** Not offered to cards with one of these keywords */
  excludes?: string[];
  /** Not offered to these card versions ("Name II") */
  excludeCards?: string[];
  /** Card versions the game offers it to although they do not meet `requires` */
  includeCards?: string[];
  /** Offered by every god */
  shared?: boolean;
  /** Cards whose in-game probability screen shows it */
  seen?: string[];
}
export interface EpiphanyTables {
  gods: string[];
  divine: Effect[];
  common: Effect[];
}

const ROMAN = ["", "I", "II", "III", "IV", "V"];
const costBracket = (cost: number) => (cost >= 4 ? "4+" : String(Math.max(0, cost)));

/**
 * What a card does, read from its text, for the epiphanies that need it. A heal or a shield
 * of the card before its epiphany still counts (the game keeps them, datamine notes).
 */
export function cardTags(variant: { type?: string; desc?: string }, base?: { name?: string; type?: string; desc?: string }) {
  const desc = variant.desc ?? "";
  const both = `${desc}\n${base?.desc ?? ""}`;
  const tags = new Set<string>();
  if (/\bHeal(?:s|ing)?\b(?! Amount)/i.test(both) || /\bHeal \d/i.test(both)) tags.add("cure");
  if (/\d+% (?:\w+-Based )?Shield|\bShield \d/i.test(both)) tags.add("shield");
  // Draws a card: "Draw", or a card taken from the Draw Pile to hand (Attack!: no draw effect at all);
  // a card only acting "in Draw Pile" does not draw
  // (game: "Select 1 Attack Card(s) in Draw Pile and move those cards to hand"; hub: "Choose … from the Draw Pile, move it to hand")
  // Gaining Fei's Flame Arts counts as drawing too: Night Rain II and V (screens), Night Rain IV
  // (no Streak: a third-party site) get no draw effect; Soulfire Dance V, which only adds a Hit to
  // Flame Arts, does
  if (/\bDraw\b(?! Pile)/i.test(desc) || /Draw Pile[^.]*\bto hand\b/i.test(desc) || /\b(?:\d+|X) Flame Arts\b/.test(desc))
    tags.add("draw");
  // Hits one chosen enemy, by the version's own text: an Attack dealing Damage; a Skill naming
  // "the target" or hitting several times ("X Flame Arts × 2": Soulfire Dance IV); none when it hits
  // all enemies (Devil Dice V). A version saying nothing of a target does not keep its base card's
  // (Thread of Light IV, Night Rain)
  const spread = /all enemies|random enem|enemy with the (?:highest|lowest)|all allies/i.test(desc);
  const aims = variant.type === "Attack" ? /Damage|Attack/i.test(desc) : /\bthe target\b/i.test(desc) || /×\s*\d/.test(desc);
  if (!spread && aims) tags.add("targetable");
  // Common epiphanies: a Skill with Exhaust gets the game's other pool (permanent buffs, AP,
  // Ego Points: Shuffle, Guilty Pleasure, Snack Time); an Attack with Exhaust does not (Hew)
  if (variant.type === "Skill" && /\*\*Exhaust(?: \d+)?\*\*/.test(desc)) tags.add("exhaust");
  // Keywords of the card ("**Weakness Attack**")
  // ("**Exhaust 2**" counts as Exhaust: Kyrken's Decrease Stress by 5 requires "kw:Exhaust")
  for (const m of desc.matchAll(/\*\*([^*]+)\*\*/g)) {
    tags.add(`kw:${m[1]}`);
    tags.add(`kw:${m[1].replace(/\s+\d+$/, "")}`);
  }
  if ((variant as { name?: string }).name) tags.add(`card:${(variant as { name?: string }).name}`);
  return tags;
}

export const fits = (e: Effect, type?: string, cost?: number, tags?: Set<string>) =>
  (!e.types.length || (type != null && e.types.includes(type))) &&
  (!e.costs.length || (cost != null && cost >= 0 && e.costs.includes(costBracket(cost)))) &&
  // An X-cost card (cost −1) counts as 0 for the divine epiphanies (checked on Soulfire Dance IV)
  (e.minCost == null || (cost != null && Math.max(0, cost) >= e.minCost)) &&
  (e.maxCost == null || (cost != null && Math.max(0, cost) <= e.maxCost)) &&
  (!tags || !e.requires?.length || e.requires.every((r) => tags.has(r)) || !!e.includeCards?.some((n) => tags.has(`card:${n}`))) &&
  (!tags || !e.forbids?.some((r) => tags.has(r))) &&
  (!tags || !e.excludes?.some((k) => tags.has(`kw:${k}`))) &&
  (!tags || !e.excludeCards?.some((n) => tags.has(`card:${n}`)));
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
  const tags = cardTags(variant, variants[0]);
  // Only on the card without its own epiphany
  const common = variant.level === 0 ? ((tables?.common ?? []).find((e) => e.id === choice.commonId && fits(e, variant.type, baseCost, tags)) ?? null) : null;
  // The game offers a divine epiphany only on a card that has an epiphany (its own or a common one)
  const divine = variant.level > 0 || common ? ((tables?.divine ?? []).find((e) => e.id === choice.divineId && fits(e, variant.type, baseCost, tags)) ?? null) : null;
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
  cls,
  basic = false,
  locked = false,
}: {
  variants: CardVariant[];
  /** A basic card: no epiphany of any kind */
  basic?: boolean;
  /** No epiphany of any kind (a basic card, or a combatant's Mythic card) */
  locked?: boolean;
  /** The owner's class: common epiphanies of other classes are left out */
  cls?: string;
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

  // What this epiphany (type, cost and what it does) can receive
  const tags = useMemo(() => cardTags(variant, variants[0]), [variant, variants]);
  const divineFor = useMemo(() => (tables?.divine ?? []).filter((e) => fits(e, variant.type, baseCost, tags)), [tables, variant.type, baseCost, tags]);
  const commonFor = useMemo(
    () => (tables?.common ?? []).filter((e) => fits(e, variant.type, baseCost, tags) && (!cls || !e.classes?.length || e.classes.includes(cls))),
    [tables, variant.type, baseCost, tags, cls]
  );
  const perGod = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of divineFor) m.set(e.god ?? "", (m.get(e.god ?? "") ?? 0) + 1);
    return m;
  }, [divineFor]);

  // A common epiphany only goes on the card without its own epiphany
  const common = level === 0 ? (commonFor.find((e) => e.id === commonId) ?? null) : null;
  // The game offers a divine epiphany only on a card that has an epiphany (its own or a common one)
  const canDivine = level > 0 || !!common;
  // A choice made for another epiphany may not fit this one any more
  const divine = canDivine ? (divineFor.find((e) => e.id === divineId) ?? null) : null;
  const dropped = (canDivine && divineId && !divine) || (level === 0 && commonId && !common);
  const pickLevel = (l: number) => {
    setLevel(l);
    if (l > 0) setCommonId(null);
    // Back to the base card with no common epiphany: no divine epiphany any more
    if (l === 0 && !commonId) setDivineId(null);
  };
  const pickCommon = (id: string | null) => {
    setCommonId(id);
    if (!id && level === 0) setDivineId(null);
  };

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

  if (basic || locked) {
    return (
      <div className="space-y-3">
        <div className="max-w-[280px]">
          <CardFace card={variants[0]} attribute={attribute} basic={basic} />
        </div>
        <p className="text-sm text-muted-foreground">{basic ? "Basic cards take no epiphany." : "A combatant's Mythic card takes no epiphany."}</p>
      </div>
    );
  }

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
              onClick={() => pickLevel(v.level)}
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
                <p className="text-xs text-muted-foreground">{`${divineFor.length} possible for a ${baseCost < 0 ? "X" : baseCost}-cost ${variant.type ?? "card"}`}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <GodChip label="All gods" active={!god} count={divineFor.length} onClick={() => setGod(null)} />
                {tables.gods.map((g) => (
                  <GodChip key={g} label={g} god={g} active={god === g} count={perGod.get(g) ?? 0} onClick={() => setGod(god === g ? null : g)} />
                ))}
              </div>
              {!canDivine ? (
                <p className="text-sm text-muted-foreground">The game offers a divine epiphany only on a card that has an epiphany: choose one of its epiphanies or a common epiphany first.</p>
              ) : (
                <EffectList items={shownDivine} selected={divineId} onSelect={setDivineId} showGod={!god} chance={divineFor.length ? 100 / divineFor.length : undefined} />
              )}
              {!canDivine ? null : divineFor.some((e) => e.seen?.includes(variant.name)) ? (
                <p className="text-xs text-emerald-300/80">Checked against the game's probability screen for this card.</p>
              ) : (
                <p className="text-xs text-amber-300/80">Worked out from the game's rules (card type, cost and what the card does): not yet checked in game for this card.</p>
              )}
            </section>
          )}

          {tables && commonFor.length > 0 && (
            <section className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">Common Epiphany</p>
                {level === 0 && <p className="text-xs text-muted-foreground">{`${commonFor.length} possible`}</p>}
              </div>
              {level === 0 ? (
                <>
                  <EffectList items={commonFor} selected={commonId} onSelect={pickCommon} chance={100 / commonFor.length} />
                  {commonFor.every((e) => e.seen?.includes(variant.name)) ? (
                    <p className="text-xs text-emerald-300/80">Checked against the game's probability screen for this card.</p>
                  ) : (
                    <p className="text-xs text-amber-300/80">Worked out from the game's rules (class, card type, cost and what the card does): not yet checked in game for this card.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">A card takes either one of its epiphanies or a common epiphany, not both. Choose Base to add a common epiphany.</p>
              )}
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

function EffectList({
  items,
  selected,
  onSelect,
  showGod,
  chance,
}: {
  items: Effect[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  showGod?: boolean;
  /** Chance of each effect, % (all effects of a pool are equally likely) */
  chance?: number;
}) {
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
            <span className="flex-1 whitespace-pre-line">{plain(e.text)}</span>
            {showGod && e.god && <span className="shrink-0 text-xs text-muted-foreground">{e.god}</span>}
            {chance != null && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{`${chance.toFixed(2)}%`}</span>}
            {selected === e.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>
        </li>
      ))}
      {!items.length && <li className="px-2 py-3 text-sm text-muted-foreground">None for this epiphany.</li>}
    </ul>
  );
}
