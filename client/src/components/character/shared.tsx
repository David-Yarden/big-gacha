/**
 * Building blocks shared by the per-game character kits.
 */
import type React from "react";
import { createContext, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { statIconUrl, hsrStatIconUrl } from "@/lib/images";
import { parseLabel } from "@/lib/formatters";
import { gameUi } from "@/lib/gameUi";
import type { TalentCombat } from "@/lib/types";
import type { MaterialCostEntry } from "@/lib/materials";
import { LANG } from "@/lib/i18n";

// ── Text rendering helpers ────────────────────────────────────────────────────

// ── Element colours in game texts (all games) ────────────────────────────────

// Readable on the dark theme; same hue family as each game's own colour.
const ELEMENT_TEXT_COLOR: Record<string, string> = {
  // Genshin
  Pyro: "#ff9b6b", Hydro: "#5fc8ff", Anemo: "#6fe0c0", Electro: "#d49bff",
  Dendro: "#a5d85a", Cryo: "#a3e9f5", Geo: "#f0c45e",
  // HSR
  Fire: "#ff7a5c", Ice: "#7fd8ff", Lightning: "#d98bff", Wind: "#4fe3a6",
  Quantum: "#9a97ff", Imaginary: "#f6d86a", Physical: "#d9dbe3",
  // WuWa
  Glacio: "#6fd3f0", Fusion: "#ff9466", Aero: "#5fe8b0", Spectro: "#f5e27a", Havoc: "#f06ab8",
};
// Highlighted terms that are not an element (like the game's yellow keywords)
const HIGHLIGHT_COLOR = "#f5d88a";

// Unambiguous names are coloured anywhere; common words only before DMG/RES/…
const ELEMENT_RE = new RegExp(
  "\\b(?:(Pyro|Hydro|Anemo|Electro|Dendro|Cryo|Geo|Quantum|Imaginary|Glacio|Spectro|Havoc|Aero)" +
    "(?:\\s(?:DMG Bonus|DMG|RES PEN|RES|Erosion|Frazzle|Flare|Burst|Resonance|Weakness|Application|Shield|Construct|Infusion|Attribute))?" +
    "|(Fire|Ice|Lightning|Wind|Physical|Fusion)\\s(?:DMG Bonus|DMG|RES PEN|RES|Weakness|Break|Attribute))\\b",
  "g"
);

function elementOf(text: string): string | undefined {
  const m = text.match(/\b(Pyro|Hydro|Anemo|Electro|Dendro|Cryo|Geo|Fire|Ice|Lightning|Wind|Quantum|Imaginary|Physical|Glacio|Fusion|Aero|Spectro|Havoc)\b/);
  return m?.[1];
}

/** Plain text with element mentions coloured. */
export function colorizeElements(text: string, keyPrefix = "e"): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(ELEMENT_RE)) {
    const el = m[1] ?? m[2];
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push(
      <span key={`${keyPrefix}${i++}`} className="font-semibold" style={{ color: ELEMENT_TEXT_COLOR[el] }}>
        {m[0]}
      </span>
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ── Hover glossary (terms the games underline) ───────────────────────────────

export interface GlossaryTerm {
  name: string;
  desc: string;
}

/** Terms of the character being viewed; set by the character page. */
export const GlossaryContext = createContext<GlossaryTerm[]>([]);

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A term with its explanation in a floating card (hover or keyboard focus). */
function Term({ term, color, children }: { term: GlossaryTerm; color?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const show = () => ref.current && setRect(ref.current.getBoundingClientRect());
  const hide = () => setRect(null);

  let style: React.CSSProperties | undefined;
  if (rect) {
    const width = Math.min(380, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = rect.bottom < window.innerHeight * 0.6;
    style = below
      ? { position: "fixed", left, top: rect.bottom + 8, width }
      : { position: "fixed", left, bottom: window.innerHeight - rect.top + 8, width };
  }

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="cursor-help font-semibold underline decoration-dotted decoration-1 underline-offset-[3px] outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary/60"
        style={{ color: color ?? HIGHLIGHT_COLOR }}
      >
        {children}
      </span>
      {rect &&
        createPortal(
          <div
            role="tooltip"
            style={style}
            className="pointer-events-none z-[100] rounded-xl border border-white/10 bg-popover/95 p-4 text-sm shadow-2xl backdrop-blur-sm"
          >
            <p className="mb-1.5 font-semibold" style={{ color: color ?? HIGHLIGHT_COLOR }}>
              {term.name}
            </p>
            <div className="whitespace-pre-line leading-relaxed text-muted-foreground">
              <GlossaryContext.Provider value={[]}>
                <GameText text={term.desc} />
              </GlossaryContext.Provider>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// One matcher per glossary (shared by every GameText of the page)
const MATCHERS = new WeakMap<GlossaryTerm[], { re: RegExp | null; byName: Map<string, GlossaryTerm> }>();
function termMatcher(terms: GlossaryTerm[]) {
  let m = MATCHERS.get(terms);
  if (!m) {
    const byName = new Map(terms.map((t) => [t.name.toLowerCase(), t]));
    const names = [...terms.map((t) => t.name)].sort((a, b) => b.length - a.length).map(escapeRe);
    const re = names.length ? new RegExp(`(?<![\\w])(${names.join("|")})(?![\\w])`, "g") : null;
    m = { re, byName };
    MATCHERS.set(terms, m);
  }
  return m;
}

/**
 * Game text: **bold** terms highlighted (element colour or gold), element mentions
 * coloured, and glossary terms hoverable.
 */
export function GameText({ text }: { text: string }) {
  const terms = useContext(GlossaryContext);
  const { re, byName } = useMemo(() => termMatcher(terms), [terms]);

  const plain = (str: string, key: string): React.ReactNode[] => {
    if (!re) return colorizeElements(str, key);
    const out: React.ReactNode[] = [];
    let last = 0;
    let n = 0;
    for (const m of str.matchAll(re)) {
      if (m.index! > last) out.push(...colorizeElements(str.slice(last, m.index), `${key}${n}-`));
      const term = byName.get(m[1].toLowerCase())!;
      const el = elementOf(m[1]);
      out.push(
        <Term key={`${key}t${n}`} term={term} color={el ? ELEMENT_TEXT_COLOR[el] : undefined}>
          {m[1]}
        </Term>
      );
      last = m.index! + m[1].length;
      n++;
    }
    if (last < str.length) out.push(...colorizeElements(str.slice(last), `${key}${n}-`));
    return out;
  };

  // genshin-db leaves empty bold pairs ("Name******"): keep only an odd closing pair
  const cleaned = text
    .replace(/\*{3,}/g, (m) => (m.length % 4 === 2 ? "**" : ""))
    // HSR player placeholders: gendered forms {M#…}{F#…} → "him/her", {NICKNAME} → the Trailblazer
    .replace(/\{M#([^}]*)\}\{F#([^}]*)\}/g, (_, m, f) => (m === f ? m : `${m}/${f}`))
    .replace(/\{F#([^}]*)\}\{M#([^}]*)\}/g, (_, f, m) => (m === f ? m : `${m}/${f}`))
    .replace(/\{[MF]#([^}]*)\}/g, "$1")
    .replace(/\{NICKNAME\}/g, LANG === "fr" ? "le Pionnier" : "the Trailblazer");
  // [[#RRGGBB|text]]: text in the game's own colour (ZZZ elements…)
  // [[key:Label|iconUrl]]: an in-game button icon (ZZZ "Press [Basic Attack]")
  const coloured = cleaned.split(/\[\[(#[0-9A-Fa-f]{6}|key:[^|\]]*)\|([^\]]+)\]\]/);
  return (
    <>
      {coloured.flatMap((seg, c) => {
        if (c % 3 === 1) return [];
        if (c % 3 === 2) {
          const color = coloured[c - 1];
          if (color.startsWith("key:")) {
            const label = color.slice(4);
            return [
              <img
                key={`k${c}`}
                src={seg}
                alt={label}
                title={label}
                className="mx-0.5 inline-block h-[1.35em] w-[1.35em] rounded-full bg-black/60 align-[-0.3em]"
              />,
            ];
          }
          const term = byName.get(seg.trim().toLowerCase());
          return term
            ? [<Term key={`c${c}`} term={term} color={color}>{seg}</Term>]
            : [<strong key={`c${c}`} className="font-semibold" style={{ color }}>{seg}</strong>];
        }
        return renderBold(seg, `s${c}-`);
      })}
    </>
  );

  function renderBold(segment: string, prefix: string): React.ReactNode[] {
    const parts = segment.split(/\*\*([^*]+)\*\*/);
    return parts.flatMap((part, i) => {
        if (i % 2 === 1) {
          const el = elementOf(part);
          const color = el ? ELEMENT_TEXT_COLOR[el] : HIGHLIGHT_COLOR;
          const term = byName.get(part.trim().toLowerCase());
          if (term) {
            return [
              <Term key={`${prefix}${i}`} term={term} color={color}>
                {part}
              </Term>,
            ];
          }
          return [
            <strong key={`${prefix}${i}`} className="font-semibold" style={{ color }}>
              {part}
            </strong>,
          ];
        }
        return plain(part, `${prefix}p${i}-`);
    });
  }
}

/** Kept for existing callers: one GameText node in an array. */
export function renderMarkdownText(text: string) {
  return [<GameText key="gt" text={text} />];
}

export function formatHsrParam(value: number, fmt: string): string {
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
export function parseHsrDesc(desc: string, params: number[][] | undefined, level: number) {
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
    return <GameText key={i} text={part} />;
  });
}


// ── Stat icon ────────────────────────────────────────────────────────────────

export function StatIcon({ substatType, className = "h-4 w-4 shrink-0" }: { substatType?: string; className?: string }) {
  if (!substatType) return null;
  const url = statIconUrl(substatType) ?? hsrStatIconUrl(substatType);
  if (!url) return null;
  return <img src={url} className={className} alt="" />;
}

// ── Genshin talent section ────────────────────────────────────────────────────

export function TalentSection({
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

export function PassiveSection({
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

export function HsrSkillSection({
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

export function MaterialCostTable({ materials, game }: { materials: MaterialCostEntry[]; game?: string }) {
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
                  <MaterialIcon mat={mat} game={game} />
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

export function MaterialIcon({ mat, game }: { mat: MaterialCostEntry; game?: string }) {
  const { src, fallback } = gameUi(game).materialIcon(mat);
  return (
    <ImageWithFallback
      src={src}
      fallbackSrc={fallback}
      alt={mat.name}
      className="h-6 w-6 shrink-0 object-contain"
    />
  );
}

// ── Stat bonus table (HSR traces, WuWa forte) ─────────────────────────────────

export function StatBonusTable({
  bonuses,
  statName = (s) => s,
  statIcon,
}: {
  bonuses: Array<{ stat: string; value: number }>;
  statName?: (stat: string) => string;
  statIcon?: (stat: string) => string | null;
}) {
  if (bonuses.length === 0) return null;
  const grouped = new Map<string, number>();
  for (const bonus of bonuses) {
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
                      {statIcon?.(stat) && (
                        <img src={statIcon(stat)!} className="h-4 w-4 opacity-70 shrink-0" alt="" />
                      )}
                      {statName(stat)}
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
}

// ── Numbered entries (constellations, eidolons, resonance chain) ─────────────

export function NumberedEntryCard({
  tag,
  name,
  description,
  iconUrl,
  highlight,
  children,
}: {
  tag: string;
  name: string;
  description: string;
  iconUrl?: string | null;
  highlight?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className={highlight ? "border-amber-500/40" : ""}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          {iconUrl && (
            <img
              src={iconUrl}
              alt={name}
              className="h-10 w-10 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{tag}</Badge>
              <h4 className="font-semibold">{name}</h4>
              {highlight && (
                <span className="text-xs font-medium text-amber-400 ml-auto">{highlight}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
              {renderMarkdownText(description)}
            </p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// ── De-duplication of reworked (Novaflare) data ───────────────────────────────

/**
 * Keep one major trace per ascension phase (A2/A4/A6).
 * When a phase appears several times, the source lists the original node first
 * and the reworked (Novaflare) node last.
 */
export function dedupeByPhase<T extends { unlockPhase?: number | null }>(
  list: T[] | undefined,
  preferOriginal: boolean
): T[] | undefined {
  if (!list || list.length < 2) return list;
  const byPhase = new Map<string, T>();
  list.forEach((item, i) => {
    const key = item.unlockPhase != null ? `p${item.unlockPhase}` : `i${i}`;
    if (!byPhase.has(key) || !preferOriginal) byPhase.set(key, item);
  });
  return [...byPhase.values()];
}

/**
 * Reworked characters list their minor stat nodes twice (old tree + new tree),
 * which doubles the totals. If the second half repeats the first half exactly,
 * keep a single copy.
 */
export function dedupeRepeatedHalf<T extends { stat: string; value: number }>(list: T[] | undefined): T[] | undefined {
  if (!list || list.length < 2 || list.length % 2 !== 0) return list;
  const half = list.length / 2;
  const sig = (x: T) => `${x.stat}:${x.value}`;
  const same = list.slice(0, half).every((x, i) => sig(x) === sig(list[i + half]));
  return same ? list.slice(0, half) : list;
}


export { nodeCosts } from "@/lib/materials";
