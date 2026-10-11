/**
 * Chaos Zero Nightmare: every card that belongs to no combatant (neutral, season, Persona,
 * forbidden, monster, event…), drawn like in the game and grouped by kind.
 * Data: the Reference table "Cards" written by the CZN sync.
 */
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { FilterBar, type FilterGroup } from "@/components/shared/FilterBar";
import { CardFace } from "@/components/czn/CardFace";
import { CardCustomizer } from "@/components/czn/CardCustomizer";
import { PersonaBuilder } from "@/components/czn/PersonaBuilder";
import { Modal } from "@/components/shared/Modal";
import { ClassIcon } from "@/components/shared/ClassIcon";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getReference } from "@/lib/api";
import { gameUi } from "@/lib/gameUi";
import { registryGame } from "@/lib/registry";
import type { Game } from "@/lib/types";

export interface NeutralCard {
  id: string;
  name: string;
  cost?: number;
  type?: string;
  kind?: string;
  desc?: string;
  group: string;
  classes?: string[];
  rarity?: string;
  image?: string;
}

// Display order of the groups, with a line about each
export const CARD_GROUPS: Array<{ id: string; label: string; note?: string }> = [
  { id: "Neutral", label: "Neutral cards", note: "Bought or found in Chaos; any combatant can use them unless a class is shown." },
  { id: "Monster", label: "Monster cards", note: "Gained from defeated monsters." },
  { id: "Forbidden", label: "Forbidden cards" },
  { id: "Persona", label: "Persona cards", note: "Season 3: a Persona's effect depends on its engravings. Click a Persona to engrave it." },
  { id: "Season 1", label: "Season 1 cards" },
  { id: "Season 2", label: "Season 2 cards" },
  { id: "Season 3", label: "Season 3 cards" },
  { id: "Season 4", label: "Season 4 cards" },
  { id: "Season 5", label: "Season 5 cards" },
  { id: "Season", label: "Other season cards" },
  { id: "Event", label: "Event cards" },
  { id: "Arena", label: "Arena cards" },
  { id: "Curse", label: "Curses" },
];

const RARITY_ORDER = ["Legendary", "Rare", "Common"];

export function CznCardsPage() {
  const { game = "czn" } = useParams<{ game: string }>();
  const [params, setParams] = useSearchParams();
  const { data, loading } = useApiQuery(() => getReference(game as Game, "Cards"), [game]);
  const cards = ((data?.data?.data as { cards?: NeutralCard[] } | undefined)?.cards ?? []) as NeutralCard[];

  const search = (params.get("search") ?? "").toLowerCase();
  const group = params.get("group");
  const type = params.get("type");
  const cls = params.get("class");

  const [open, setOpen] = useState<NeutralCard | null>(null);
  const present = useMemo(() => new Set(cards.map((c) => c.group)), [cards]);
  const classes = registryGame(game)?.specialties ?? [];
  const ui = gameUi(game);

  const filterGroups: FilterGroup[] = [
    { key: "group", label: "Kind", options: CARD_GROUPS.filter((g) => present.has(g.id)).map((g) => ({ value: g.id, label: g.id })) },
    { key: "type", label: "Type", options: ["Attack", "Skill", "Upgrade"].map((t) => ({ value: t, label: t })) },
    {
      key: "class",
      label: "Class",
      options: classes.map((c) => ({ value: c, label: c, icon: ui.specialtyIcon?.(c) ?? undefined })),
    },
  ];

  const shown = cards.filter(
    (c) =>
      (!search || c.name.toLowerCase().includes(search) || c.desc?.toLowerCase().includes(search)) &&
      (!group || c.group === group) &&
      (!type || c.type === type) &&
      (!cls || !c.classes?.length || c.classes.includes(cls))
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cards</h1>
        {cards.length > 0 && <span className="text-sm text-muted-foreground">{`${shown.length} / ${cards.length}`}</span>}
      </div>

      <FilterBar searchParams={params} setSearchParams={setParams} searchPlaceholder="Search cards..." filterGroups={filterGroups} />

      {loading && !cards.length && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {CARD_GROUPS.map((g) => {
        const list = shown.filter((c) => c.group === g.id);
        if (!list.length) return null;
        // Monster cards: by grade, then name
        list.sort((a, b) => {
          const ra = RARITY_ORDER.indexOf(a.rarity ?? "");
          const rb = RARITY_ORDER.indexOf(b.rarity ?? "");
          return (ra < 0 ? 9 : ra) - (rb < 0 ? 9 : rb) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
        });
        return (
          <section key={g.id} className="space-y-3">
            <div>
              <h2 className="text-lg font-bold">
                {g.label} <span className="text-sm font-normal text-muted-foreground">{`(${list.length})`}</span>
              </h2>
              {g.note && <p className="text-sm text-muted-foreground">{g.note}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {list.map((c) => (
                <div key={c.id} className="space-y-1.5">
                  <CardFace
                    card={{ name: c.name, cost: c.cost, type: c.type ?? c.kind, desc: c.desc, rarity: c.rarity, image: c.image }}
                    onClick={() => setOpen(c)}
                  />
                  <div className="flex min-h-5 flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                    {c.rarity && <span>{c.rarity}</span>}
                    {c.classes?.map((k) => {
                      const icon = ui.specialtyIcon?.(k);
                      return (
                        <span key={k} className="inline-flex items-center gap-0.5" title={k}>
                          {icon && <ClassIcon src={icon} size={15} />}
                          {k}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? (open.group === "Persona" ? "Persona engravings" : open.name) : ""}>
        {open &&
          (open.group === "Persona" ? (
            <PersonaBuilder base={open} classes={classes} />
          ) : (
            <CardCustomizer variants={[{ level: 0, name: open.name, cost: open.cost, type: open.type, desc: open.desc, rarity: open.rarity, image: open.image }]} />
          ))}
      </Modal>

      {!loading && cards.length > 0 && !shown.length && <p className="py-10 text-center text-muted-foreground">No card matches.</p>}
      <p className="pt-4 text-xs text-muted-foreground">Data: hub-czn-updated (game files, MIT) · monster grades: CZN Deck Builder community.</p>
    </div>
  );
}
