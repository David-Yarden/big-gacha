/**
 * Chaos Zero Nightmare deck builder: three combatants, their starting and unique cards, the
 * cards added on top (neutral, season, monster, forbidden, Persona…), each card with its
 * epiphany, divine and common epiphanies (or Persona engravings). Decks are saved in the
 * local database and can be exported as a picture or as text.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Check, ClipboardCopy, Copy, Download, FilePlus2, Loader2, Plus, Save, Search, Trash2, UserPlus, X } from "lucide-react";
import { CardFace } from "@/components/czn/CardFace";
import { CardCustomizer, builtCard, useEpiphanyTables, plain, type CardChoice, type EpiphanyTables } from "@/components/czn/CardCustomizer";
import { PersonaBuilder, personaFace, usePersonaTables, type PersonaChoice, type PersonaTables } from "@/components/czn/PersonaBuilder";
import { variantsOf, type CznCard, type CznKit } from "@/components/character/kits/czn";
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
  listDecks,
  saveDeck,
  type Deck,
  type DeckCard,
  type DeckSummary,
} from "@/lib/api";
import { gameUi } from "@/lib/gameUi";
import { keyName } from "@/lib/i18n";
import { registryGame } from "@/lib/registry";
import type { Character, Game } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CARD_GROUPS, type NeutralCard } from "./CznCardsPage";
import { toPng } from "@/vendor/html-to-image";

const GAME = "czn" as Game;
const TYPES = ["Attack", "Skill", "Upgrade"];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
const newUid = () => Math.random().toString(36).slice(2, 10);
const emptyDeck = (): Deck => ({ name: "New deck", team: [], cards: [], notes: "" });
/** What is saved (for the "unsaved changes" check) */
const snapshot = (d: Deck) => JSON.stringify({ name: d.name, team: d.team, cards: d.cards, notes: d.notes ?? "" });

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
}

function resolve(
  entry: DeckCard,
  ctx: { kits: Record<string, CznKit>; extras: Map<string, NeutralCard>; tables: EpiphanyTables | null; persona?: PersonaTables; attributes: Record<string, string | undefined> }
): Resolved | null {
  if (entry.source === "kit") {
    const card = ctx.kits[entry.owner ?? ""]?.cards?.find((c) => c.id === entry.cardId);
    if (!card) return null;
    const b = builtCard(variantsOf(card), entry as Partial<CardChoice>, ctx.tables);
    // Epiphany variants are usually named "Card II": the level only when the name does not say it
    const level = b.variant.level && !b.variant.name.endsWith(` ${ROMAN[b.variant.level]}`) ? ` [Epiphany ${ROMAN[b.variant.level]}]` : "";
    const parts = [b.variant.name + level];
    if (b.divine) parts.push(`Divine (${b.divine.god}): ${plain(b.divine.text)}`);
    if (b.common) parts.push(`+ ${plain(b.common.text)}`);
    return {
      entry,
      kitCard: card,
      name: b.variant.name,
      type: b.variant.type,
      cost: b.cost,
      line: parts.join(" · "),
      face: {
        card: { ...b.variant, cost: b.cost },
        attribute: ctx.attributes[entry.owner ?? ""],
        epiphany: b.variant.level > 0,
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

function TeamSlot({ member, onPick, onRemove }: { member?: Character; onPick: () => void; onRemove?: () => void }) {
  const ui = gameUi("czn");
  if (!member) {
    return (
      <button
        type="button"
        onClick={onPick}
        className="flex h-full min-h-28 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 text-sm text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
      >
        <UserPlus className="h-5 w-5" />
        Add a combatant
      </button>
    );
  }
  const cls = member.specialty ? ui.specialtyIcon?.(member.specialty) : undefined;
  return (
    <div className="relative flex items-center gap-3 rounded-xl border border-white/[0.08] bg-card/60 p-3">
      <img src={viaCache(member.images?.icon ?? null) ?? undefined} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-black/30 object-cover" />
      <div className="min-w-0">
        <p className="truncate font-semibold">{member.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {cls && <ClassIcon src={cls} size={16} />}
          {[member.specialty, member.element].filter(Boolean).join(" · ")}
        </p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          title="Remove from the team (and its cards)"
          aria-label="Remove from the team"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

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

function AddCards({ cards, onAdd }: { cards: NeutralCard[]; onAdd: (c: NeutralCard) => void }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>("Neutral");
  const [type, setType] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const present = new Set(cards.map((c) => c.group));
  const shown = cards.filter(
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

function Summary({ cards }: { cards: Resolved[] }) {
  const byType = TYPES.map((t) => [t, cards.filter((c) => c.type === t).length] as const);
  const curve = [0, 1, 2, 3, 4].map((n) => cards.filter((c) => (n === 4 ? (c.cost ?? 0) >= 4 : c.cost === n)).length);
  const max = Math.max(1, ...curve);
  const costed = cards.filter((c) => c.cost != null && c.cost >= 0);
  const avg = costed.length ? costed.reduce((s, c) => s + (c.cost ?? 0), 0) / costed.length : 0;
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3 rounded-xl border border-white/[0.08] bg-card/60 px-4 py-3">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Cards</p>
        <p className="text-2xl font-bold tabular-nums">{cards.length}</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Average cost</p>
        <p className="text-2xl font-bold tabular-nums">{avg.toFixed(2)}</p>
      </div>
      <div className="flex gap-4">
        {byType.map(([t, n]) => (
          <div key={t}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{t}</p>
            <p className="text-lg font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Cost curve</p>
        <div className="flex items-end gap-1.5">
          {curve.map((n, i) => (
            <div key={i} className="flex w-7 flex-col items-center gap-0.5">
              <span className="text-[10px] tabular-nums text-muted-foreground">{n}</span>
              <div className="w-full rounded-sm bg-primary/70" style={{ height: `${4 + (n / max) * 36}px` }} />
              <span className="text-[11px] text-muted-foreground">{i === 4 ? "4+" : i}</span>
            </div>
          ))}
        </div>
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

// ── Page ──────────────────────────────────────────────────────────────────────

export function CznDecksPage() {
  const { game = "czn" } = useParams<{ game: string }>();
  const [params, setParams] = useSearchParams();
  const deckId = params.get("deck");

  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [deck, setDeck] = useState<Deck>(emptyDeck);
  const [saved, setSaved] = useState(snapshot(emptyDeck()));
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const { data: charData } = useApiQuery(() => getCharacters(GAME, { limit: 100, sort: "-version" }), []);
  const characters = useMemo(() => (charData?.data ?? []) as Character[], [charData]);
  const byName = useMemo(() => new Map(characters.map((c) => [keyName(c), c])), [characters]);
  const { data: refData } = useApiQuery(() => getReference(GAME, "Cards"), []);
  const extraCards = useMemo(() => ((refData?.data?.data as { cards?: NeutralCard[] } | undefined)?.cards ?? []) as NeutralCard[], [refData]);
  const extras = useMemo(() => new Map(extraCards.map((c) => [c.id, c])), [extraCards]);
  const tables = useEpiphanyTables();
  const persona = usePersonaTables();
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
        setDeck(r.data);
        setSaved(snapshot(r.data));
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
  const pending = deck.cards.length - resolved.length;

  const update = (fn: (d: Deck) => Deck) => setDeck((d) => fn(d));
  const updateCard = (uid: string, patch: Partial<DeckCard>) =>
    update((d) => ({ ...d, cards: d.cards.map((c) => (c.uid === uid ? { ...c, ...patch } : c)) }));

  async function addMember(c: Character) {
    setPicking(false);
    const name = keyName(c);
    if (deck.team.includes(name) || deck.team.length >= 3) return;
    update((d) => ({ ...d, team: [...d.team, name] }));
    try {
      const kit = (await getAgentKit(GAME, name)).data as unknown as CznKit;
      const cards: DeckCard[] = (kit.cards ?? [])
        .filter((k) => k.kind === "start" || k.kind === "unique")
        .map((k) => ({ uid: newUid(), source: "kit", owner: name, cardId: k.id, level: 0 }));
      update((d) => ({ ...d, cards: [...d.cards.filter((x) => x.owner !== name || x.source !== "kit"), ...cards] }));
    } catch {
      setStatus(`Could not load ${c.name}'s cards.`);
    }
  }
  const removeMember = (name: string) =>
    update((d) => ({ ...d, team: d.team.filter((t) => t !== name), cards: d.cards.filter((c) => !(c.source === "kit" && c.owner === name)) }));

  const addExtra = (c: NeutralCard) => update((d) => ({ ...d, cards: [...d.cards, { uid: newUid(), source: "extra", cardId: c.id, level: 0 }] }));
  const copyCard = (uid: string) =>
    update((d) => {
      const i = d.cards.findIndex((c) => c.uid === uid);
      if (i < 0) return d;
      const cards = [...d.cards];
      cards.splice(i + 1, 0, { ...d.cards[i], uid: newUid() });
      return { ...d, cards };
    });
  const removeCard = (uid: string) => update((d) => ({ ...d, cards: d.cards.filter((c) => c.uid !== uid) }));

  async function save(asNew = false) {
    setBusy(true);
    setStatus(null);
    try {
      const body = { ...deck, name: deck.name.trim() || "New deck" };
      const r = deck._id && !asNew ? await saveDeck(GAME, deck._id, body) : await createDeck(GAME, asNew ? { ...body, _id: undefined, name: `${body.name} (copy)` } : body);
      setDeck(r.data);
      setSaved(snapshot(r.data));
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
    setStatus(null);
    setParams(id ? { deck: id } : {});
  }

  async function copyText() {
    const lines = [`${deck.name} — Chaos Zero Nightmare`, `Team: ${deck.team.map((n) => byName.get(n)?.name ?? n).join(", ") || "none"}`, ""];
    for (const owner of [...deck.team, null]) {
      const list = resolved.filter((r) => (owner ? r.entry.source === "kit" && r.entry.owner === owner : r.entry.source === "extra"));
      if (!list.length) continue;
      lines.push(owner ? `${byName.get(owner)?.name ?? owner}:` : "Added cards:");
      for (const r of list) lines.push(`- (${r.cost ?? "–"}) ${r.line}`);
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
  const groups = [...deck.team.map((n) => ({ key: n, title: byName.get(n)?.name ?? n })), { key: "", title: "Added cards" }];

  if (game !== "czn") return <p className="py-10 text-center text-muted-foreground">The deck builder is for Chaos Zero Nightmare.</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Saved decks */}
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">My decks</h2>
          <button type="button" onClick={() => open(null)} className="rounded-md p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground" title="New deck" aria-label="New deck">
            <FilePlus2 className="h-4 w-4" />
          </button>
        </div>
        {!decks && <p className="text-sm text-muted-foreground">Loading…</p>}
        {decks && !decks.length && <p className="text-sm text-muted-foreground">No saved deck yet.</p>}
        <ul className="space-y-1">
          {decks?.map((d) => (
            <li key={d._id}>
              <button
                type="button"
                onClick={() => open(d._id)}
                className={cn("w-full rounded-lg border px-3 py-2 text-left transition", d._id === deck._id ? "border-primary/50 bg-primary/10" : "border-white/[0.06] hover:bg-white/5")}
              >
                <span className="block truncate text-sm font-medium">{d.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {`${d.team.map((n) => byName.get(n)?.name ?? n).join(", ") || "No team"} · ${d.count} cards`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0 space-y-5">
        {/* Name and actions */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={deck.name}
            onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
            maxLength={80}
            aria-label="Deck name"
            className="min-w-48 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-bold outline-none hover:border-white/10 focus:border-primary/60"
          />
          <button
            type="button"
            onClick={() => save()}
            disabled={busy || (!dirty && !!deck._id)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {dirty || !deck._id ? "Save" : "Saved"}
          </button>
          {deck._id && (
            <button type="button" onClick={() => save(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50">
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
          )}
          <button type="button" onClick={exportImage} disabled={busy || !resolved.length} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50">
            <Download className="h-4 w-4" />
            Picture
          </button>
          <button type="button" onClick={copyText} disabled={!resolved.length} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50">
            <ClipboardCopy className="h-4 w-4" />
            Text
          </button>
          {deck._id && (
            <button type="button" onClick={remove} className="rounded-md p-2 text-muted-foreground hover:bg-white/10 hover:text-red-400" title="Delete this deck" aria-label="Delete this deck">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        {(status || dirty) && <p className="text-sm text-muted-foreground">{status ?? "Unsaved changes."}</p>}

        {/* What the picture shows: the team, the summary and the cards */}
        <div ref={exportRef} className="space-y-5 rounded-xl p-1">
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => {
              const name = deck.team[i];
              return (
                <TeamSlot
                  key={name ?? `empty-${i}`}
                  member={name ? byName.get(name) ?? ({ name, _id: name } as Character) : undefined}
                  onPick={() => setPicking(true)}
                  onRemove={name ? () => removeMember(name) : undefined}
                />
              );
            })}
          </div>

          {resolved.length > 0 && <Summary cards={resolved} />}

          {groups.map(({ key, title }) => {
            const list = resolved.filter((r) => (key ? r.entry.source === "kit" && r.entry.owner === key : r.entry.source === "extra"));
            if (!key && !list.length) return null;
            const ego = key ? kits[key]?.cards?.find((c) => c.kind === "ego") : undefined;
            return (
              <section key={key || "extra"} className="space-y-3">
                <h3 className="text-base font-semibold">
                  {title} <span className="text-sm font-normal text-muted-foreground">{`(${list.length})`}</span>
                  {ego && <span className="ml-2 text-xs font-normal text-muted-foreground">{`Ego skill: ${ego.name}`}</span>}
                </h3>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                  {list.map((r) => (
                    <DeckCardTile key={r.entry.uid} r={r} onOpen={() => setEditing(r.entry.uid)} onCopy={() => copyCard(r.entry.uid)} onRemove={() => removeCard(r.entry.uid)} />
                  ))}
                  {key && !list.length && <p className="col-span-full text-sm text-muted-foreground">Loading cards…</p>}
                </div>
              </section>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-4 py-2.5 text-sm text-muted-foreground transition hover:border-primary/60 hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Add neutral, season, monster or Persona cards
        </button>
        {pending > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {`Loading ${pending} card${pending > 1 ? "s" : ""}…`}
          </p>
        )}
        {!deck.team.length && !deck.cards.length && (
          <p className="text-sm text-muted-foreground">Start with the team: each combatant brings its starting and unique cards. Click a card to choose its epiphanies.</p>
        )}
      </div>

      <Modal open={picking} onClose={() => setPicking(false)} title="Add a combatant">
        <CombatantPicker all={characters} taken={deck.team} onPick={addMember} />
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add cards">
        <AddCards cards={extraCards} onAdd={addExtra} />
      </Modal>
      <Modal
        open={!!editingCard}
        onClose={() => setEditing(null)}
        title={editingCard ? `${editingCard.entry.owner ? `${byName.get(editingCard.entry.owner)?.name ?? editingCard.entry.owner} · ` : ""}${editingCard.name}` : ""}
      >
        {editingCard && (
          <div className="space-y-4">
            {editingCard.extraCard?.group === "Persona" ? (
              <PersonaBuilder
                key={editingCard.entry.uid}
                base={{ ...editingCard.extraCard, type: editingCard.extraCard.type ?? editingCard.extraCard.kind }}
                classes={classes}
                initial={{
                  engravings: [editingCard.entry.engravings?.[0] || null, editingCard.entry.engravings?.[1] || null],
                  personaClass: editingCard.entry.personaClass ?? null,
                }}
                onChange={(c: PersonaChoice) => updateCard(editingCard.entry.uid, { engravings: c.engravings.map((e) => e ?? ""), personaClass: c.personaClass })}
              />
            ) : (
              <CardCustomizer
                key={editingCard.entry.uid}
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
