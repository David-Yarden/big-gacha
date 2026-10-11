/**
 * Chaos Zero Nightmare deck builder, laid out like the game's run setup: one column per
 * combatant (up to three), each with its own header (partner, equipment, Chaos tier, Save
 * Data) and its own deck below — the combatant's base deck to start with, then the cards
 * added to it (neutral, season, monster, forbidden, Persona… within its class). Each card
 * takes its epiphany, divine and common epiphanies (or Persona engravings). Decks are saved
 * in the local database and can be exported as a picture or as text.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Check,
  ClipboardCopy,
  Copy,
  Download,
  FilePlus2,
  FolderOpen,
  Gem,
  Hammer,
  Layers,
  Loader2,
  MinusCircle,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  Sparkles,
  Sword,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { CardFace } from "@/components/czn/CardFace";
import { CardCustomizer, builtCard, useEpiphanyTables, plain, type CardChoice, type EpiphanyTables } from "@/components/czn/CardCustomizer";
import { PersonaBuilder, personaFace, usePersonaTables, type PersonaChoice, type PersonaTables } from "@/components/czn/PersonaBuilder";
import { isBasic, variantsOf, type CznCard, type CznKit } from "@/components/character/kits/czn";
import { Modal } from "@/components/shared/Modal";
import { ClassIcon } from "@/components/shared/ClassIcon";
import { viaCache } from "@/components/shared/ImageWithFallback";
import { useApiQuery } from "@/hooks/useApiQuery";
import {
  createDeck,
  deleteDeck,
  getAgentKit,
  getCharacters,
  getDeck,
  getReference,
  getWeapons,
  listDecks,
  saveDeck,
  type Deck,
  type DeckCard,
  type DeckEquipment,
  type DeckMember,
  type DeckSummary,
  type EquipmentSlotName,
} from "@/lib/api";
import { MAX_COPIES, MAX_REMOVALS, MAX_TIER, saveData, type SaveCard, type SaveEquipment, type SaveRemoved } from "@/lib/cznSaveData";
import { gameUi } from "@/lib/gameUi";
import { keyName } from "@/lib/i18n";
import { registryGame } from "@/lib/registry";
import type { Character, Game, Weapon } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CARD_GROUPS, type NeutralCard } from "./CznCardsPage";
import { toPng } from "@/vendor/html-to-image";

const GAME = "czn" as Game;
const TYPES = ["Attack", "Skill", "Upgrade"];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
const DEFAULT_TIER = 14;
const newUid = () => Math.random().toString(36).slice(2, 10);
const emptyDeck = (): Deck => ({ name: "New deck", team: [], cards: [], notes: "", members: {} });
const memberOf = (d: Deck, name: string): DeckMember => d.members?.[name] ?? { tier: DEFAULT_TIER, equipment: {}, partner: null };
/** What is saved (for the "unsaved changes" check) */
const snapshot = (d: Deck) =>
  JSON.stringify({
    name: d.name,
    team: d.team,
    cards: d.cards,
    notes: d.notes ?? "",
    members: Object.fromEntries(d.team.map((n) => [n, { tier: memberOf(d, n).tier ?? DEFAULT_TIER, equipment: memberOf(d, n).equipment ?? {}, partner: memberOf(d, n).partner ?? null }])),
  });

/**
 * Older decks had one Chaos tier and one equipment set for the whole team, and added cards
 * without an owner: the tier goes to every combatant, the equipment and the cards to the first.
 */
function normalize(d: Deck): Deck {
  const members: Record<string, DeckMember> = {};
  d.team.forEach((name, i) => {
    const m = d.members?.[name];
    members[name] = {
      tier: m?.tier ?? d.tier ?? DEFAULT_TIER,
      equipment: m?.equipment ?? (i === 0 ? (d.equipment ?? {}) : {}),
      partner: m?.partner ?? null,
    };
  });
  const first = d.team[0];
  const cards = d.cards
    .map((c) => (c.owner || !first ? c : { ...c, owner: first }))
    // A divine epiphany needs an epiphany (its own or a common one): older decks may have one alone
    .map((c) => (c.divineId && !c.level && !c.commonId ? { ...c, divineId: null } : c));
  return { ...d, members, cards, tier: undefined, equipment: undefined };
}

interface EquipmentItem {
  id: string;
  type: EquipmentSlotName;
  name: string;
  rarity?: string;
  desc?: string;
  /** The community's text (translated by machine, the game's terms put back) */
  community?: boolean;
  /** The game's text, with the values of the community list */
  values?: "community";
  /** Only a Japanese text exists */
  lang?: "ja";
  chaos?: string[];
  image?: string;
}
interface EquipmentTables {
  items: EquipmentItem[];
  refinements: Array<{ id: string; text: string }>;
}
const SLOTS: Array<{ slot: EquipmentSlotName; label: string }> = [
  { slot: "weapon", label: "Weapon" },
  { slot: "armor", label: "Armor" },
  { slot: "pendant", label: "Accessory" },
];
const EQ_RARITY_COLOR: Record<string, string> = { Rare: "#7fd2ff", Legendary: "#ffc54d", Unique: "#ff7d9c" };

/** Combatants' kits, loaded once each. */
function useKits(team: string[]) {
  const [kits, setKits] = useState<Record<string, CznKit>>({});
  const asked = useRef(new Set<string>());
  useEffect(() => {
    for (const name of team) {
      if (asked.current.has(name)) continue;
      asked.current.add(name);
      getAgentKit(GAME, name)
        .then((r) => setKits((k) => ({ ...k, [name]: r.data as unknown as CznKit })))
        .catch(() => setKits((k) => ({ ...k, [name]: { cards: [] } })));
    }
  }, [team]);
  return kits;
}

/** Everything needed to draw a deck card. */
interface Resolved {
  entry: DeckCard;
  name: string;
  type?: string;
  cost?: number;
  face: Parameters<typeof CardFace>[0];
  /** For the text export */
  line: string;
  kitCard?: CznCard;
  extraCard?: NeutralCard;
  /** What the Save Data counts */
  save: SaveCard;
}

function resolve(
  entry: DeckCard,
  ctx: { kits: Record<string, CznKit>; extras: Map<string, NeutralCard>; tables: EpiphanyTables | null; persona?: PersonaTables; attributes: Record<string, string | undefined> }
): Resolved | null {
  if (entry.source === "kit") {
    const card = ctx.kits[entry.owner ?? ""]?.cards?.find((c) => c.id === entry.cardId);
    if (!card) return null;
    // A basic card takes no epiphany: choices saved on it are ignored
    const basic = isBasic(card);
    const b = builtCard(variantsOf(card), basic ? { level: 0 } : (entry as Partial<CardChoice>), ctx.tables);
    // Epiphany variants are usually named "Card II": the level only when the name does not say it
    const level = b.variant.level && !b.variant.name.endsWith(` ${ROMAN[b.variant.level]}`) ? ` [Epiphany ${ROMAN[b.variant.level]}]` : "";
    const parts = [b.variant.name + level];
    if (b.divine) parts.push(`Divine (${b.divine.god}): ${plain(b.divine.text)}`);
    if (b.common) parts.push(`+ ${plain(b.common.text)}`);
    return {
      entry,
      kitCard: card,
      save: {
        name: b.variant.name,
        source: "kit",
        kind: card.kind,
        basic,
        divine: !!b.divine,
        copied: entry.copied,
      },
      name: b.variant.name,
      type: b.variant.type,
      cost: b.cost,
      line: parts.join(" · "),
      face: {
        card: { ...b.variant, cost: b.cost },
        attribute: ctx.attributes[entry.owner ?? ""],
        epiphany: b.variant.level > 0,
        basic,
        divine: b.divine ? { text: b.divine.text, god: b.divine.god } : undefined,
        extra: b.common ? [b.common.text] : undefined,
      },
    };
  }
  const card = ctx.extras.get(entry.cardId);
  if (!card) return null;
  if (card.group === "Persona") {
    const chosen = (entry.engravings ?? []).map((id) => ctx.persona?.engravings.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e);
    const p = personaFace({ ...card, type: card.type ?? card.kind }, chosen, ctx.persona);
    return {
      entry,
      extraCard: card,
      save: { name: card.name, source: "extra", group: "Persona", copied: entry.copied },
      name: card.name,
      type: p.card.type,
      cost: p.card.cost,
      line: [card.name, ...chosen.map((e) => `${e.eidolon}: ${plain(e.text)}`)].join(" · "),
      face: { card: p.card, extra: p.extra.length ? p.extra : undefined },
    };
  }
  const variants = [{ level: 0, name: card.name, cost: card.cost, type: card.type ?? card.kind, desc: card.desc, rarity: card.rarity, image: card.image }];
  const b = builtCard(variants, entry as Partial<CardChoice>, ctx.tables);
  const parts = [card.name];
  if (b.divine) parts.push(`Divine (${b.divine.god}): ${plain(b.divine.text)}`);
  if (b.common) parts.push(`+ ${plain(b.common.text)}`);
  return {
    entry,
    extraCard: card,
    save: { name: card.name, source: "extra", group: card.group, rarity: card.rarity, divine: !!b.divine, copied: entry.copied },
    name: card.name,
    type: b.variant.type,
    cost: b.cost,
    line: parts.join(" · "),
    face: {
      card: { ...b.variant, cost: b.cost },
      divine: b.divine ? { text: b.divine.text, god: b.divine.god } : undefined,
      extra: b.common ? [b.common.text] : undefined,
    },
  };
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function CombatantPicker({ all, taken, onPick }: { all: Character[]; taken: string[]; onPick: (c: Character) => void }) {
  const ui = gameUi("czn");
  const [q, setQ] = useState("");
  const [cls, setCls] = useState<string | null>(null);
  const classes = registryGame("czn")?.specialties ?? [];
  const shown = all.filter((c) => (!q || c.name.toLowerCase().includes(q.toLowerCase())) && (!cls || c.specialty === cls));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search combatants..."
            className="w-full rounded-md border border-white/10 bg-card py-1.5 pl-8 pr-3 text-sm outline-none focus:border-primary/60"
          />
        </div>
        {classes.map((c) => {
          const icon = ui.specialtyIcon?.(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCls(cls === c ? null : c)}
              className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs", cls === c ? "border-transparent bg-white/15" : "border-white/10 hover:bg-white/10")}
            >
              {icon && <ClassIcon src={icon} size={16} />}
              {c}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
        {shown.map((c) => {
          const used = taken.includes(keyName(c));
          return (
            <button
              key={c._id}
              type="button"
              disabled={used}
              onClick={() => onPick(c)}
              className="group space-y-1 rounded-lg p-1 text-center transition hover:bg-white/5 disabled:opacity-35"
            >
              <img src={viaCache(c.images?.icon ?? null) ?? undefined} alt="" loading="lazy" className="mx-auto aspect-square w-full rounded-lg bg-black/30 object-cover" />
              <span className="block truncate text-xs">{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


/** The cards a combatant of this class can add: those of no class or of its class. */
const allowedFor = (cls: string | undefined, c: { classes?: string[] }) => !c.classes?.length || (!!cls && c.classes.includes(cls));

function AddCards({ cards, cls, onAdd }: { cards: NeutralCard[]; cls?: string; onAdd: (c: NeutralCard) => void }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>("Neutral");
  const [type, setType] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const usable = cards.filter((c) => allowedFor(cls, c));
  const present = new Set(usable.map((c) => c.group));
  const shown = usable.filter(
    (c) =>
      (!group || c.group === group) &&
      (!type || (c.type ?? c.kind) === type) &&
      (!q || c.name.toLowerCase().includes(q.toLowerCase()) || c.desc?.toLowerCase().includes(q.toLowerCase()))
  );
  const chip = (active: boolean) => cn("rounded-full border px-2.5 py-1 text-xs", active ? "border-transparent bg-white/15" : "border-white/10 hover:bg-white/10");
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cards..."
            className="w-full rounded-md border border-white/10 bg-card py-1.5 pl-8 pr-3 text-sm outline-none focus:border-primary/60"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(!group)} onClick={() => setGroup(null)}>
            All
          </button>
          {CARD_GROUPS.filter((g) => present.has(g.id)).map((g) => (
            <button key={g.id} type="button" className={chip(group === g.id)} onClick={() => setGroup(group === g.id ? null : g.id)}>
              {g.id}
            </button>
          ))}
          <span className="mx-1 w-px bg-white/10" />
          {TYPES.map((t) => (
            <button key={t} type="button" className={chip(type === t)} onClick={() => setType(type === t ? null : t)}>
              {t}
            </button>
          ))}
        </div>
        {cls && <p className="text-xs text-muted-foreground">{`Only the cards a ${cls} can use.`}</p>}
      </div>
      <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((c) => (
          <div key={c.id} className="relative">
            <CardFace
              card={{ name: c.name, cost: c.cost, type: c.type ?? c.kind, desc: c.desc, rarity: c.rarity, image: c.image }}
              onClick={() => {
                onAdd(c);
                setAdded(c.id);
                setTimeout(() => setAdded((a) => (a === c.id ? null : a)), 1200);
              }}
            />
            {added === c.id && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[4%/2.7%] bg-black/60 text-sm font-semibold">
                <Check className="mr-1 h-4 w-4 text-emerald-400" />
                Added
              </span>
            )}
          </div>
        ))}
        {!shown.length && <p className="col-span-full py-6 text-center text-sm text-muted-foreground">No card matches.</p>}
      </div>
    </div>
  );
}

function DeckCardTile({ r, onOpen, onCopy, onRemove }: { r: Resolved; onOpen: () => void; onCopy: () => void; onRemove: () => void }) {
  return (
    <div className="group relative">
      <CardFace {...r.face} onClick={onOpen} />
      <div className="absolute -right-1.5 -top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100" data-export-hide>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-full border border-white/15 bg-background/90 p-1.5 text-muted-foreground shadow hover:text-foreground"
          title="Add a copy"
          aria-label="Add a copy"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full border border-white/15 bg-background/90 p-1.5 text-muted-foreground shadow hover:text-red-400"
          title="Remove from the deck"
          aria-label="Remove from the deck"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function SaveDetails({ result }: { result: ReturnType<typeof saveData> }) {
  return (
    <div className="space-y-1">
      {!result.lines.length && <p className="text-sm text-muted-foreground">Nothing costs points yet: a combatant's own cards are free.</p>}
      {result.lines.map((l, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate">
            {l.label}
            <span className="ml-2 text-xs text-muted-foreground">{l.note}</span>
            {l.unsure && (
              <span className="ml-1 text-xs text-amber-300" title="No source gives the cost of this kind of card: counted as a neutral card">
                (unverified)
              </span>
            )}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{l.points}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-white/10 pt-2 text-sm font-semibold">
        <span>Total</span>
        <span className={cn("tabular-nums", result.over && "text-red-400")}>{`${result.total} / ${result.cap}`}</span>
      </div>
      {result.over && <p className="text-sm text-red-400">Over the cap: the game will not keep this deck as it is.</p>}
      {(result.tooManyCopies || result.tooManyRemovals) && <p className="text-sm text-red-400">{`At most ${MAX_COPIES} copies and ${MAX_REMOVALS} removals per Save Data.`}</p>}
      <p className="pt-2 text-xs text-muted-foreground">
        Rules of the developer note of January 26, 2026 (Season 2). Cap: 30 at tier 1, +10 per tier, up to 180 at tier 16.
      </p>
    </div>
  );
}

const SLOT_ICON: Record<EquipmentSlotName, typeof Sword> = { weapon: Sword, armor: Shield, pendant: Gem };

/** One equipment slot: the piece, its refinement and God's Hammer. */
function EquipmentEditor({
  slot,
  value,
  tables,
  onChange,
}: {
  slot: EquipmentSlotName;
  value?: DeckEquipment;
  tables: EquipmentTables;
  onChange: (v: DeckEquipment | null) => void;
}) {
  const [choosing, setChoosing] = useState(!value);
  const byId = useMemo(() => new Map(tables.items.map((e) => [e.id, e])), [tables]);
  const item = value ? byId.get(value.id) : undefined;
  if (choosing || !item || !value) {
    return (
      <EquipmentPicker
        items={tables.items}
        slot={slot}
        onPick={(id) => {
          onChange({ id, refinement: value?.refinement ?? null, hammer: null });
          setChoosing(false);
        }}
      />
    );
  }
  const hammer = value.hammer ? byId.get(value.hammer) : undefined;
  const refinement = tables.refinements.find((r) => r.id === value.refinement);
  const select = "w-full rounded-md border border-white/10 bg-card px-2 py-1.5 text-sm";
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <img src={viaCache(item.image ?? null) ?? undefined} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-black/30 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold" style={{ color: EQ_RARITY_COLOR[item.rarity ?? ""] }}>
            {item.name}
          </p>
          <p className="text-sm text-muted-foreground">{item.desc}</p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            {item.lang === "ja"
              ? "No English text yet: Japanese text of the community list."
              : item.community
                ? "Community text translated by machine, with the game's terms (unverified wording)."
                : item.values
                  ? "Game text; values from the community list."
                  : "Game text."}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => setChoosing(true)} className="rounded-md border border-white/10 px-2.5 py-1 text-sm hover:bg-white/5">
            Change
          </button>
          <button type="button" onClick={() => onChange(null)} className="rounded-md border border-white/10 px-2.5 py-1 text-sm text-red-300 hover:bg-red-500/10">
            Remove
          </button>
        </div>
      </div>
      <label className="block space-y-1">
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          Refinement
        </span>
        <select value={value.refinement ?? ""} onChange={(e) => onChange({ ...value, refinement: e.target.value || null })} className={select}>
          <option value="">None</option>
          {tables.refinements.map((r) => (
            <option key={r.id} value={r.id}>
              {r.text}
            </option>
          ))}
        </select>
        {refinement && <span className="block text-sm text-amber-200">{refinement.text}</span>}
      </label>
      <label className="block space-y-1">
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Hammer className="h-4 w-4" />
          God's Hammer
        </span>
        <select value={value.hammer ?? ""} onChange={(e) => onChange({ ...value, hammer: e.target.value || null })} className={select}>
          <option value="">None</option>
          {tables.items
            .filter((e) => e.type === slot && e.id !== item.id)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {`${e.name} — ${e.desc}`}
              </option>
            ))}
        </select>
        {hammer && <span className="block text-sm text-orange-300">{`${hammer.name}: ${hammer.desc}`}</span>}
      </label>
      <p className="text-xs text-muted-foreground">
        Equipment: the game's names and texts from hub-czn-updated where known, else CZN Deck Builder community. Refinement texts: CZN Deck Builder community (unverified wording).
      </p>
    </div>
  );
}

function PartnerPicker({ partners, cls, current, onPick }: { partners: Weapon[]; cls?: string; current?: string | null; onPick: (name: string | null) => void }) {
  const [q, setQ] = useState("");
  const usable = partners.filter((p) => (!cls || !p.weaponType || p.weaponType === cls) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search partners..."
            className="w-full rounded-md border border-white/10 bg-card py-1.5 pl-8 pr-3 text-sm outline-none focus:border-primary/60"
          />
        </div>
        {current && (
          <button type="button" onClick={() => onPick(null)} className="rounded-md border border-white/10 px-2.5 py-1 text-sm hover:bg-white/5">
            No partner
          </button>
        )}
      </div>
      {cls && <p className="text-xs text-muted-foreground">{`${cls} partners`}</p>}
      <ul className="grid max-h-[60vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {usable.map((p) => (
          <li key={p._id}>
            <button
              type="button"
              onClick={() => onPick(keyName(p))}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-2 text-left hover:border-primary/50 hover:bg-white/5",
                current === keyName(p) ? "border-primary/60 bg-primary/10" : "border-white/[0.08]"
              )}
            >
              <img src={viaCache(p.images?.icon ?? null) ?? undefined} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-md bg-black/30 object-cover" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {p.name} <span className="text-xs font-normal text-amber-300">{"★".repeat(p.rarity || 0)}</span>
                </span>
                {p.effectName && <span className="block text-xs text-foreground/80">{p.effectName}</span>}
                {p.refinements?.[0]?.description && <span className="line-clamp-3 block text-xs text-muted-foreground">{plain(p.refinements[0].description)}</span>}
              </span>
            </button>
          </li>
        ))}
        {!usable.length && <li className="col-span-full py-6 text-center text-sm text-muted-foreground">No partner matches.</li>}
      </ul>
    </div>
  );
}

/** The cards of a combatant's base deck that are no longer in its deck (each copy of a duplicated starting card counts). */
function removedOf(owner: string, ownerName: string, kit: CznCard[] | undefined, cards: DeckCard[]) {
  const out: Array<SaveRemoved & { cardId: string }> = [];
  if (!kit) return out;
  const present = new Map<string, number>();
  for (const e of cards) if (e.source === "kit" && e.owner === owner && !e.copied) present.set(e.cardId, (present.get(e.cardId) ?? 0) + 1);
  for (const c of kit) {
    if (c.kind !== "start" && c.kind !== "unique") continue;
    const left = present.get(c.id) ?? 0;
    if (left > 0) present.set(c.id, left - 1);
    else out.push({ name: c.name, owner: ownerName, kind: c.kind, cardId: c.id });
  }
  return out;
}

interface ColumnInfo {
  name: string;
  member: Character;
  settings: DeckMember;
  cards: Resolved[];
  removed: Array<SaveRemoved & { cardId: string }>;
  equipment: SaveEquipment[];
  save: ReturnType<typeof saveData>;
  partner?: Weapon;
  ego?: CznCard;
  loading: boolean;
}

function CombatantColumn({
  col,
  eqTables,
  onTier,
  onSlot,
  onPartner,
  onRemoveMember,
  onDetails,
  onAdd,
  onOpenCard,
  onCopyCard,
  onRemoveCard,
  onRestore,
}: {
  col: ColumnInfo;
  eqTables: EquipmentTables | null;
  onTier: (tier: number) => void;
  onSlot: (slot: EquipmentSlotName) => void;
  onPartner: () => void;
  onRemoveMember: () => void;
  onDetails: () => void;
  onAdd: () => void;
  onOpenCard: (uid: string) => void;
  onCopyCard: (uid: string) => void;
  onRemoveCard: (uid: string) => void;
  onRestore: (cardId: string) => void;
}) {
  const ui = gameUi("czn");
  const cls = col.member.specialty ? ui.specialtyIcon?.(col.member.specialty) : undefined;
  const pct = Math.min(100, (col.save.total / col.save.cap) * 100);
  const byId = useMemo(() => new Map((eqTables?.items ?? []).map((e) => [e.id, e])), [eqTables]);
  const tier = col.settings.tier ?? DEFAULT_TIER;
  const uniques = SLOTS.filter(({ slot }) => byId.get(col.settings.equipment?.[slot]?.id ?? "")?.rarity === "Unique").length;
  return (
    <section className="min-w-0 space-y-3">
      {/* Header */}
      <div className={cn("space-y-2 rounded-xl border bg-card/70 p-2.5", col.save.over || col.save.tooManyCopies || col.save.tooManyRemovals ? "border-red-500/60" : "border-white/[0.08]")}>
        <div className="flex items-center gap-2">
          <img src={viaCache(col.member.images?.icon ?? null) ?? undefined} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-black/30 object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{col.member.name}</p>
            <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              {cls && <ClassIcon src={cls} size={14} />}
              {[col.member.specialty, col.member.element].filter(Boolean).join(" · ")}
            </div>
          </div>
          {SLOTS.map(({ slot, label }) => {
            const v = col.settings.equipment?.[slot];
            const item = v ? byId.get(v.id) : undefined;
            const Icon = SLOT_ICON[slot];
            const extras = [v?.refinement && "Refinement", v?.hammer && "God's Hammer"].filter(Boolean).join(" + ");
            return (
              <button
                key={slot}
                type="button"
                onClick={() => onSlot(slot)}
                title={item ? `${item.name}${extras ? ` (${extras})` : ""}: ${item.desc ?? ""}` : label}
                aria-label={label}
                className={cn(
                  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-black/20 text-muted-foreground transition hover:border-primary/60 hover:text-foreground",
                  item ? "border-white/15" : "border-dashed border-white/15"
                )}
                style={item ? { borderColor: EQ_RARITY_COLOR[item.rarity ?? ""] } : undefined}
              >
                {item?.image ? <img src={viaCache(item.image) ?? undefined} alt="" className="h-8 w-8 object-contain" /> : <Icon className="h-4 w-4" />}
                {(v?.refinement || v?.hammer) && (
                  <span className="absolute -bottom-1 -right-1 flex gap-0.5">
                    {v?.refinement && <Sparkles className="h-3 w-3 text-amber-200" />}
                    {v?.hammer && <Hammer className="h-3 w-3 text-orange-300" />}
                  </span>
                )}
              </button>
            );
          })}
          <select
            value={tier}
            onChange={(e) => onTier(Number(e.target.value))}
            title="Chaos tier"
            aria-label="Chaos tier"
            className="shrink-0 rounded-md border border-white/10 bg-card px-1 py-0.5 text-xs font-semibold text-amber-300"
          >
            {Array.from({ length: MAX_TIER }, (_, i) => i + 1).map((t) => (
              <option key={t} value={t}>
                {`T${t}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onRemoveMember}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            title="Remove from the team (and its cards)"
            aria-label="Remove from the team"
            data-export-hide
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <button
            type="button"
            onClick={onPartner}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-white/10 py-0.5 pl-0.5 pr-2 hover:border-primary/60"
            title={col.partner ? `${col.partner.effectName ?? ""}${col.partner.refinements?.[0]?.description ? `: ${plain(col.partner.refinements[0].description)}` : ""}` : "Select partner"}
          >
            {col.partner ? (
              <img src={viaCache(col.partner.images?.icon ?? null) ?? undefined} alt="" className="h-5 w-5 rounded object-cover" />
            ) : (
              <Users className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="truncate">{col.partner ? col.partner.name : "Select partner"}</span>
          </button>
          {col.ego && (
            <span className="truncate text-muted-foreground" title={col.ego.desc ? plain(col.ego.desc) : undefined}>
              {`Ego: ${col.ego.name}`}
            </span>
          )}
          <button type="button" onClick={onDetails} className="ml-auto font-semibold tabular-nums hover:underline" title="Save Data details">
            <span className={col.save.over ? "text-red-400" : "text-amber-300"}>{col.save.total}</span>
            <span className="text-muted-foreground">{` / ${col.save.cap}`}</span>
          </button>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className={cn("h-full rounded-full", col.save.over ? "bg-red-500" : "bg-amber-400")} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
          <span className="inline-flex items-center gap-1" title="Cards">
            <Layers className="h-3.5 w-3.5" />
            {col.cards.length}
          </span>
          <span className={cn("inline-flex items-center gap-1", col.save.tooManyRemovals && "text-red-400")} title="Removals">
            <MinusCircle className="h-3.5 w-3.5" />
            {`${col.save.removals}/${MAX_REMOVALS}`}
          </span>
          <span className={cn("inline-flex items-center gap-1", col.save.tooManyCopies && "text-red-400")} title="Copies">
            <Copy className="h-3.5 w-3.5" />
            {`${col.save.copies}/${MAX_COPIES}`}
          </span>
          {uniques > 1 && <span className="text-red-400">Only one Unique piece of equipment can be equipped.</span>}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 2xl:grid-cols-4">
        {col.cards.map((r) => (
          <DeckCardTile key={r.entry.uid} r={r} onOpen={() => onOpenCard(r.entry.uid)} onCopy={() => onCopyCard(r.entry.uid)} onRemove={() => onRemoveCard(r.entry.uid)} />
        ))}
        {col.loading && (
          <p className="col-span-full flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading cards…
          </p>
        )}
        <button
          type="button"
          onClick={onAdd}
          className="flex aspect-[2/3] items-center justify-center rounded-[4%/2.7%] border border-dashed border-amber-400/30 text-amber-300/70 transition hover:border-amber-300 hover:text-amber-200"
          title="Add cards"
          aria-label="Add cards"
          data-export-hide
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {col.removed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-export-hide>
          <span className="text-xs text-muted-foreground">Removed:</span>
          {col.removed.map((r, i) => (
            <button
              key={`${r.cardId}-${i}`}
              type="button"
              onClick={() => onRestore(r.cardId)}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-card/60 px-2 py-0.5 text-xs hover:border-primary/50"
              title="Put it back in the deck"
            >
              <RotateCcw className="h-3 w-3 text-muted-foreground" />
              {r.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyColumn({ onPick }: { onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      data-export-hide
      className="flex min-h-40 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 text-sm text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
    >
      <UserPlus className="h-5 w-5" />
      Add a combatant
    </button>
  );
}

function DeckList({ decks, current, byName, onOpen }: { decks: DeckSummary[] | null; current?: string; byName: Map<string, Character>; onOpen: (id: string) => void }) {
  if (!decks) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!decks.length) return <p className="text-sm text-muted-foreground">No saved deck yet.</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {decks.map((d) => (
        <li key={d._id}>
          <button
            type="button"
            onClick={() => onOpen(d._id)}
            className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition", d._id === current ? "border-primary/50 bg-primary/10" : "border-white/[0.08] hover:bg-white/5")}
          >
            <span className="flex shrink-0 -space-x-2">
              {d.team.map((n) => (
                <img key={n} src={viaCache(byName.get(n)?.images?.icon ?? null) ?? undefined} alt="" className="h-8 w-8 rounded-full border-2 border-background bg-black/30 object-cover" />
              ))}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{d.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{`${d.team.map((n) => byName.get(n)?.name ?? n).join(", ") || "No team"} · ${d.count} cards`}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function EquipmentPicker({ items, slot, onPick }: { items: EquipmentItem[]; slot: EquipmentSlotName; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState<string | null>(null);
  const list = items.filter((e) => e.type === slot && (!rarity || e.rarity === rarity) && (!q || `${e.name} ${e.desc}`.toLowerCase().includes(q.toLowerCase())));
  const chip = (active: boolean) => cn("rounded-full border px-2.5 py-1 text-xs", active ? "border-transparent bg-white/15" : "border-white/10 hover:bg-white/10");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search equipment..."
            className="w-full rounded-md border border-white/10 bg-card py-1.5 pl-8 pr-3 text-sm outline-none focus:border-primary/60"
          />
        </div>
        {["Rare", "Legendary", "Unique"].map((r) => (
          <button key={r} type="button" className={chip(rarity === r)} onClick={() => setRarity(rarity === r ? null : r)}>
            {r}
          </button>
        ))}
      </div>
      <ul className="grid max-h-[60vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {list.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onPick(e.id)} className="flex w-full items-start gap-3 rounded-lg border border-white/[0.08] p-2 text-left hover:border-primary/50 hover:bg-white/5">
              <img src={viaCache(e.image ?? null) ?? undefined} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-md bg-black/30 object-contain" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold" style={{ color: EQ_RARITY_COLOR[e.rarity ?? ""] }}>
                  {e.name}
                </span>
                <span className="block text-xs text-muted-foreground">{e.desc}</span>
              </span>
            </button>
          </li>
        ))}
        {!list.length && <li className="col-span-full py-6 text-center text-sm text-muted-foreground">No equipment matches.</li>}
      </ul>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Dialog =
  | { kind: "pick" }
  | { kind: "decks" }
  | { kind: "add"; owner: string }
  | { kind: "slot"; owner: string; slot: EquipmentSlotName }
  | { kind: "partner"; owner: string }
  | { kind: "details"; owner: string }
  | null;

export function CznDecksPage() {
  const { game = "czn" } = useParams<{ game: string }>();
  const [params, setParams] = useSearchParams();
  const deckId = params.get("deck");

  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [deck, setDeck] = useState<Deck>(emptyDeck);
  const [saved, setSaved] = useState(snapshot(emptyDeck()));
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const { data: charData } = useApiQuery(() => getCharacters(GAME, { limit: 100, sort: "-version" }), []);
  const characters = useMemo(() => (charData?.data ?? []) as Character[], [charData]);
  const byName = useMemo(() => new Map(characters.map((c) => [keyName(c), c])), [characters]);
  const { data: partnerData } = useApiQuery(() => getWeapons(GAME, { limit: 200 }), []);
  const partners = useMemo(() => (partnerData?.data ?? []) as Weapon[], [partnerData]);
  const partnersByName = useMemo(() => new Map(partners.map((p) => [keyName(p), p])), [partners]);
  const { data: refData } = useApiQuery(() => getReference(GAME, "Cards"), []);
  const extraCards = useMemo(() => ((refData?.data?.data as { cards?: NeutralCard[] } | undefined)?.cards ?? []) as NeutralCard[], [refData]);
  const extras = useMemo(() => new Map(extraCards.map((c) => [c.id, c])), [extraCards]);
  const tables = useEpiphanyTables();
  const persona = usePersonaTables();
  const { data: eqData } = useApiQuery(() => getReference(GAME, "Equipment"), []);
  const eqTables = (eqData?.data?.data as EquipmentTables | undefined) ?? null;
  const kits = useKits(deck.team);
  const classes = registryGame("czn")?.specialties ?? [];

  const refreshList = useCallback(() => listDecks(GAME).then((r) => setDecks(r.data), () => setDecks([])), []);
  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // Open the deck of the URL
  useEffect(() => {
    if (!deckId) {
      const d = emptyDeck();
      setDeck(d);
      setSaved(snapshot(d));
      return;
    }
    getDeck(GAME, deckId).then(
      (r) => {
        const d = normalize(r.data);
        setDeck(d);
        setSaved(snapshot(d));
      },
      () => setStatus("This deck no longer exists.")
    );
  }, [deckId]);

  const dirty = snapshot(deck) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const attributes = useMemo(() => Object.fromEntries(deck.team.map((n) => [n, byName.get(n)?.element])), [deck.team, byName]);
  const resolved = useMemo(
    () => deck.cards.map((e) => resolve(e, { kits, extras, tables, persona, attributes })).filter((r): r is Resolved => !!r),
    [deck.cards, kits, extras, tables, persona, attributes]
  );

  // One column per combatant, with its own Save Data
  const columns: ColumnInfo[] = deck.team.map((name) => {
    const member = byName.get(name) ?? ({ name, _id: name } as Character);
    const settings = memberOf(deck, name);
    const cards = resolved.filter((r) => r.entry.owner === name);
    const removed = removedOf(name, member.name, kits[name]?.cards, deck.cards);
    const equipment: SaveEquipment[] = SLOTS.flatMap(({ slot }) => {
      const v = settings.equipment?.[slot];
      if (!v?.id) return [];
      const item = eqTables?.items.find((e) => e.id === v.id);
      return [{ slot, name: item?.name ?? v.id, refinement: !!v.refinement, hammer: !!v.hammer }];
    });
    return {
      name,
      member,
      settings,
      cards,
      removed,
      equipment,
      save: saveData(
        cards.map((r) => r.save),
        removed,
        equipment,
        settings.tier ?? DEFAULT_TIER
      ),
      partner: settings.partner ? partnersByName.get(settings.partner) : undefined,
      ego: kits[name]?.cards?.find((c) => c.kind === "ego"),
      loading: !kits[name] || deck.cards.filter((c) => c.owner === name).length > cards.length,
    };
  });
  const columnOf = (owner?: string) => columns.find((c) => c.name === owner);

  const update = (fn: (d: Deck) => Deck) => setDeck((d) => fn(d));
  const updateCard = (uid: string, patch: Partial<DeckCard>) => update((d) => ({ ...d, cards: d.cards.map((c) => (c.uid === uid ? { ...c, ...patch } : c)) }));
  const updateMember = (name: string, patch: Partial<DeckMember>) =>
    update((d) => ({ ...d, members: { ...(d.members ?? {}), [name]: { ...memberOf(d, name), ...patch } } }));

  /** A combatant's base deck: its starting cards (duplicates included) then its unique cards. */
  const baseDeck = (name: string, kit: CznKit): DeckCard[] =>
    (kit.cards ?? []).filter((k) => k.kind === "start" || k.kind === "unique").map((k) => ({ uid: newUid(), source: "kit", owner: name, cardId: k.id, level: 0 }));

  async function addMember(c: Character) {
    setDialog(null);
    const name = keyName(c);
    if (deck.team.includes(name) || deck.team.length >= 3) return;
    update((d) => ({ ...d, team: [...d.team, name], members: { ...(d.members ?? {}), [name]: { tier: DEFAULT_TIER, equipment: {}, partner: null } } }));
    try {
      const kit = (await getAgentKit(GAME, name)).data as unknown as CznKit;
      update((d) => ({ ...d, cards: [...d.cards.filter((x) => x.owner !== name), ...baseDeck(name, kit)] }));
    } catch {
      setStatus(`Could not load ${c.name}'s cards.`);
    }
  }
  const removeMember = (name: string) =>
    update((d) => {
      const members = { ...(d.members ?? {}) };
      delete members[name];
      return { ...d, team: d.team.filter((t) => t !== name), cards: d.cards.filter((c) => c.owner !== name), members };
    });
  const restore = (owner: string, cardId: string) => update((d) => ({ ...d, cards: [...d.cards, { uid: newUid(), source: "kit", owner, cardId, level: 0 }] }));

  function addExtra(owner: string, c: NeutralCard) {
    const uid = newUid();
    update((d) => ({ ...d, cards: [...d.cards, { uid, source: "extra", owner, cardId: c.id, level: 0 }] }));
    // A Persona is engraved right away
    if (c.group === "Persona") {
      setDialog(null);
      setEditing(uid);
    }
  }
  const copyCard = (uid: string) =>
    update((d) => {
      const i = d.cards.findIndex((c) => c.uid === uid);
      if (i < 0) return d;
      const cards = [...d.cards];
      cards.splice(i + 1, 0, { ...d.cards[i], uid: newUid(), copied: true });
      return { ...d, cards };
    });
  const removeCard = (uid: string) => update((d) => ({ ...d, cards: d.cards.filter((c) => c.uid !== uid) }));

  function resetCards() {
    if (!deck.team.length || !window.confirm("Put every combatant back to its base deck (added cards and epiphanies removed)?")) return;
    update((d) => ({ ...d, cards: d.team.flatMap((n) => (kits[n] ? baseDeck(n, kits[n]) : d.cards.filter((c) => c.owner === n))) }));
  }

  async function save(asNew = false) {
    setBusy(true);
    setStatus(null);
    try {
      const body = { ...deck, name: deck.name.trim() || "New deck" };
      const r = deck._id && !asNew ? await saveDeck(GAME, deck._id, body) : await createDeck(GAME, asNew ? { ...body, _id: undefined, name: `${body.name} (copy)` } : body);
      const d = normalize(r.data);
      setDeck(d);
      setSaved(snapshot(d));
      if (r.data._id !== deckId) setParams({ deck: r.data._id! });
      setStatus(asNew ? "Copy saved." : "Saved.");
      refreshList();
    } catch (err) {
      setStatus(`Not saved: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deck._id || !window.confirm(`Delete the deck "${deck.name}"?`)) return;
    await deleteDeck(GAME, deck._id).catch(() => undefined);
    setParams({});
    refreshList();
  }

  function open(id: string | null) {
    if (dirty && !window.confirm("Leave this deck without saving its changes?")) return;
    setDialog(null);
    setStatus(null);
    setParams(id ? { deck: id } : {});
  }

  async function copyText() {
    const lines = [`${deck.name} — Chaos Zero Nightmare`, ""];
    for (const col of columns) {
      lines.push(`${col.member.name} (${col.member.specialty ?? "?"}) — Chaos tier ${col.settings.tier ?? DEFAULT_TIER}, Save Data ${col.save.total} / ${col.save.cap}`);
      if (col.partner) lines.push(`Partner: ${col.partner.name}`);
      for (const { slot, label } of SLOTS) {
        const v = col.settings.equipment?.[slot];
        const item = v ? eqTables?.items.find((e) => e.id === v.id) : undefined;
        if (!item || !v) continue;
        const parts = [item.name];
        if (v.refinement) parts.push(`refinement: ${eqTables?.refinements.find((r) => r.id === v.refinement)?.text ?? v.refinement}`);
        if (v.hammer) parts.push(`God's Hammer: ${eqTables?.items.find((e) => e.id === v.hammer)?.name ?? v.hammer}`);
        lines.push(`${label}: ${parts.join(" · ")}`);
      }
      for (const r of col.cards) lines.push(`- (${r.cost == null ? "–" : r.cost < 0 ? "X" : r.cost}) ${r.line}`);
      if (col.removed.length) lines.push(`Removed: ${col.removed.map((r) => r.name).join(", ")}`);
      lines.push("");
    }
    lines.push(`${resolved.length} cards`);
    await navigator.clipboard.writeText(lines.join("\n"));
    setStatus("Deck copied as text.");
  }

  async function exportImage() {
    if (!exportRef.current) return;
    setBusy(true);
    setStatus("Making the picture…");
    try {
      const url = await toPng(exportRef.current, {
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        filter: (n: HTMLElement) => !(n instanceof HTMLElement && n.hasAttribute("data-export-hide")),
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(deck.name || "deck").replace(/[^\w\- ]+/g, "").trim() || "deck"}.png`;
      a.click();
      setStatus("Picture downloaded.");
    } catch (err) {
      setStatus(`Picture failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const editingCard = resolved.find((r) => r.entry.uid === editing) ?? null;
  const editingCol = columnOf(editingCard?.entry.owner);
  const dialogCol = dialog && "owner" in dialog ? columnOf(dialog.owner) : undefined;

  // Deck summary (all combatants)
  const costed = resolved.filter((c) => c.cost != null && c.cost >= 0);
  const avg = costed.length ? costed.reduce((s, c) => s + (c.cost ?? 0), 0) / costed.length : 0;
  const byType = TYPES.map((t) => [t, resolved.filter((c) => c.type === t).length] as const);

  if (game !== "czn") return <p className="py-10 text-center text-muted-foreground">The deck builder is for Chaos Zero Nightmare.</p>;

  const tool = "inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50";
  return (
    // Wider than the site's usual column: three decks side by side
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-[1900px] -translate-x-1/2 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-card/60 px-3 py-2">
        <input
          value={deck.name}
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
          maxLength={80}
          aria-label="Deck name"
          className="w-56 min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-lg font-bold outline-none hover:border-white/10 focus:border-primary/60"
        />
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Layers className="h-4 w-4" />
          <span className="font-semibold tabular-nums text-foreground">{resolved.length}</span>
          cards
        </span>
        {resolved.length > 0 && (
          <span className="hidden text-xs tabular-nums text-muted-foreground md:inline">
            {`Avg cost ${avg.toFixed(2)} · ${byType.map(([t, n]) => `${t} ${n}`).join(" · ")}`}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setDialog({ kind: "decks" })} className={tool}>
            <FolderOpen className="h-4 w-4" />
            My decks
          </button>
          <button type="button" onClick={() => open(null)} className={tool} title="New deck">
            <FilePlus2 className="h-4 w-4" />
            New
          </button>
          <button type="button" onClick={copyText} disabled={!resolved.length} className={tool}>
            <ClipboardCopy className="h-4 w-4" />
            Text
          </button>
          <button type="button" onClick={exportImage} disabled={busy || !resolved.length} className={tool}>
            <Download className="h-4 w-4" />
            Picture
          </button>
          {deck._id && (
            <button type="button" onClick={() => save(true)} disabled={busy} className={tool}>
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
          )}
          <button type="button" onClick={resetCards} disabled={!deck.team.length} className={tool} title="Back to each combatant's base deck">
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          {deck._id && (
            <button type="button" onClick={remove} className={cn(tool, "text-red-300 hover:bg-red-500/10")} title="Delete this deck">
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => save()}
            disabled={busy || (!dirty && !!deck._id)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {dirty || !deck._id ? "Save" : "Saved"}
          </button>
        </div>
      </div>
      {(status || dirty) && <p className="text-sm text-muted-foreground">{status ?? "Unsaved changes."}</p>}

      {/* The three decks (what the picture shows) */}
      <div ref={exportRef} className="grid gap-4 rounded-xl p-1 lg:grid-cols-3">
        {[0, 1, 2].map((i) => {
          const col = columns[i];
          if (!col) return <EmptyColumn key={`empty-${i}`} onPick={() => setDialog({ kind: "pick" })} />;
          return (
            <CombatantColumn
              key={col.name}
              col={col}
              eqTables={eqTables}
              onTier={(tier) => updateMember(col.name, { tier })}
              onSlot={(slot) => setDialog({ kind: "slot", owner: col.name, slot })}
              onPartner={() => setDialog({ kind: "partner", owner: col.name })}
              onRemoveMember={() => removeMember(col.name)}
              onDetails={() => setDialog({ kind: "details", owner: col.name })}
              onAdd={() => setDialog({ kind: "add", owner: col.name })}
              onOpenCard={setEditing}
              onCopyCard={copyCard}
              onRemoveCard={removeCard}
              onRestore={(cardId) => restore(col.name, cardId)}
            />
          );
        })}
      </div>
      {!deck.team.length && (
        <p className="text-sm text-muted-foreground">
          Start with the team: each combatant brings its base deck (starting and unique cards). Click a card to choose its epiphanies, the + to add neutral, season,
          monster or Persona cards.
        </p>
      )}

      <Modal open={dialog?.kind === "pick"} onClose={() => setDialog(null)} title="Add a combatant">
        <CombatantPicker all={characters} taken={deck.team} onPick={addMember} />
      </Modal>
      <Modal open={dialog?.kind === "decks"} onClose={() => setDialog(null)} title="My decks">
        <DeckList decks={decks} current={deck._id} byName={byName} onOpen={open} />
      </Modal>
      <Modal open={dialog?.kind === "add"} onClose={() => setDialog(null)} title={dialogCol ? `Add cards · ${dialogCol.member.name}` : "Add cards"}>
        {dialog?.kind === "add" && <AddCards cards={extraCards} cls={dialogCol?.member.specialty} onAdd={(c) => addExtra(dialog.owner, c)} />}
      </Modal>
      <Modal
        open={dialog?.kind === "slot"}
        onClose={() => setDialog(null)}
        title={dialog?.kind === "slot" ? `${dialogCol?.member.name ?? ""} · ${SLOTS.find((s) => s.slot === dialog.slot)?.label ?? ""}` : ""}
      >
        {dialog?.kind === "slot" && eqTables && dialogCol && (
          <EquipmentEditor
            key={`${dialog.owner}-${dialog.slot}`}
            slot={dialog.slot}
            value={dialogCol.settings.equipment?.[dialog.slot]}
            tables={eqTables}
            onChange={(v) => {
              const equipment = { ...(dialogCol.settings.equipment ?? {}) };
              if (v) equipment[dialog.slot] = v;
              else delete equipment[dialog.slot];
              updateMember(dialog.owner, { equipment });
              if (!v) setDialog(null);
            }}
          />
        )}
      </Modal>
      <Modal open={dialog?.kind === "partner"} onClose={() => setDialog(null)} title={dialogCol ? `Partner · ${dialogCol.member.name}` : "Partner"}>
        {dialog?.kind === "partner" && (
          <PartnerPicker
            partners={partners}
            cls={dialogCol?.member.specialty}
            current={dialogCol?.settings.partner}
            onPick={(partner) => {
              updateMember(dialog.owner, { partner });
              setDialog(null);
            }}
          />
        )}
      </Modal>
      <Modal open={dialog?.kind === "details"} onClose={() => setDialog(null)} title={dialogCol ? `Save Data · ${dialogCol.member.name}` : "Save Data"}>
        {dialogCol && <SaveDetails result={dialogCol.save} />}
      </Modal>
      <Modal open={!!editingCard} onClose={() => setEditing(null)} title={editingCard ? `${editingCol ? `${editingCol.member.name} · ` : ""}${editingCard.name}` : ""}>
        {editingCard && (
          <div className="space-y-4">
            {editingCard.extraCard?.group === "Persona" ? (
              <PersonaBuilder
                key={editingCard.entry.uid}
                base={{ ...editingCard.extraCard, type: editingCard.extraCard.type ?? editingCard.extraCard.kind }}
                classes={classes}
                initial={{
                  engravings: [editingCard.entry.engravings?.[0] || null, editingCard.entry.engravings?.[1] || null],
                  personaClass: editingCard.entry.personaClass ?? editingCol?.member.specialty ?? null,
                }}
                onChange={(c: PersonaChoice) => updateCard(editingCard.entry.uid, { engravings: c.engravings.map((e) => e ?? ""), personaClass: c.personaClass })}
              />
            ) : (
              <CardCustomizer
                key={editingCard.entry.uid}
                basic={!!editingCard.kitCard && isBasic(editingCard.kitCard)}
                cls={editingCol?.member.specialty}
                variants={
                  editingCard.kitCard
                    ? variantsOf(editingCard.kitCard)
                    : [
                        {
                          level: 0,
                          name: editingCard.name,
                          cost: editingCard.extraCard?.cost,
                          type: editingCard.extraCard?.type ?? editingCard.extraCard?.kind,
                          desc: editingCard.extraCard?.desc,
                          rarity: editingCard.extraCard?.rarity,
                          image: editingCard.extraCard?.image,
                        },
                      ]
                }
                attribute={editingCard.face.attribute}
                initial={{ level: editingCard.entry.level, divineId: editingCard.entry.divineId ?? null, commonId: editingCard.entry.commonId ?? null }}
                onChange={(c: CardChoice) => updateCard(editingCard.entry.uid, { level: c.level, divineId: c.divineId, commonId: c.commonId })}
              />
            )}
            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
              <button type="button" onClick={() => copyCard(editingCard.entry.uid)} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5">
                <Copy className="h-4 w-4" />
                Add a copy
              </button>
              <button
                type="button"
                onClick={() => (removeCard(editingCard.entry.uid), setEditing(null))}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
                Remove from the deck
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
