/**
 * Chaos Zero Nightmare combatant kit: the deck (starting cards, unique cards with their
 * epiphany variants, Ego skill) and the six Ego Manifestations.
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getAgentKit } from "@/lib/api";
import { GameText } from "@/components/character/shared";
import { CardFace } from "@/components/czn/CardFace";
import { Modal } from "@/components/shared/Modal";
import { CardCustomizer, type CardVariant } from "@/components/czn/CardCustomizer";
import type { CharacterKit, KitArgs } from "./types";

export interface CznCard {
  id: string;
  kind: "start" | "unique" | "ego";
  name: string;
  cost?: number;
  type?: string;
  desc?: string;
  epiphanies?: Array<{ level: number; name: string; cost?: number; type?: string; desc?: string }>;
  /** Text from a community transcription (not yet in the game files or on the wiki) */
  community?: boolean;
  /** Normal / Rare / Legendary / Mythic */
  rarity?: string;
  /** Card art */
  image?: string;
}
export interface CznKit {
  cards?: CznCard[];
  manifestations?: Array<{ level: number; name?: string; kind?: string; desc?: string }>;
}

/** The card and its epiphanies, for the customiser and the deck builder. */
export function variantsOf(card: CznCard): CardVariant[] {
  const face = { name: card.name, cost: card.cost, type: card.type, desc: card.desc, rarity: card.rarity, image: card.image };
  return [
    { ...face, level: 0 },
    ...(card.epiphanies ?? []).map((v) => ({ ...face, level: v.level, name: v.name, cost: v.cost, type: v.type ?? card.type, desc: v.desc })),
  ];
}

function CardView({ card, owner, attribute }: { card: CznCard; owner: string; attribute?: string }) {
  const [open, setOpen] = useState(false);
  const variants = card.epiphanies ?? [];
  const face = { name: card.name, cost: card.cost, type: card.type, desc: card.desc, rarity: card.rarity, image: card.image };
  const all = variantsOf(card);
  return (
    <div className="space-y-1.5">
      <CardFace card={face} attribute={attribute} onClick={() => setOpen(true)} />
      <button type="button" onClick={() => setOpen(true)} className="w-full text-center text-xs font-medium text-primary hover:underline">
        {variants.length ? `Epiphanies (${variants.length})` : "Divine Epiphany"}
      </button>
      {card.community && (
        <p
          className="text-center text-[10px] leading-tight text-amber-300/80"
          title="Typed from the game by the CZN Deck Builder community; replaced by the official data when it is published"
        >
          Community transcription (unverified)
        </p>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={`${owner} · ${card.name}`}>
        <CardCustomizer variants={all} attribute={attribute} />
      </Modal>
    </div>
  );
}

function CardText({ text }: { text?: string }) {
  if (!text) return <p className="text-sm italic text-muted-foreground">No text yet.</p>;
  return (
    <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
      <GameText text={text} />
    </div>
  );
}

const GROUPS: Array<{ kind: CznCard["kind"]; label: string }> = [
  { kind: "start", label: "Starting cards" },
  { kind: "unique", label: "Unique cards" },
  { kind: "ego", label: "Ego skill" },
];

export function useCznKit({ game, name, element }: KitArgs): CharacterKit {
  const { data } = useApiQuery(() => getAgentKit(game, name), [game, name]);
  const kit = data?.data as unknown as CznKit | undefined;
  const cards = kit?.cards ?? [];

  const cardsTab = (
    <div className="space-y-6">
      {GROUPS.map(({ kind, label }) => {
        const list = cards.filter((c) => c.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="space-y-3">
            <h3 className="text-lg font-semibold">{label}</h3>
            <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {list.map((c) => (
                <CardView key={c.id} card={c} owner={name} attribute={element} />
              ))}
            </div>
          </section>
        );
      })}
      {kit && !cards.length && <p className="text-sm text-muted-foreground">No card data yet.</p>}
    </div>
  );

  const egoTab = (
    <div className="space-y-3">
      {(kit?.manifestations ?? []).map((m) => (
        <Card key={m.level}>
          <CardContent className="space-y-1.5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border px-2 py-0.5 text-xs font-semibold">{`E${m.level}`}</span>
              <h4 className="font-semibold">{m.name}</h4>
              {m.kind && <span className="text-xs text-muted-foreground">{m.kind}</span>}
            </div>
            <CardText text={m.desc} />
          </CardContent>
        </Card>
      ))}
      {kit && !kit.manifestations?.length && <p className="text-sm text-muted-foreground">No Ego Manifestation data yet.</p>}
    </div>
  );

  return {
    tabs: [
      { value: "cards", label: "Cards", content: cardsTab },
      { value: "ego", label: "Ego Manifestation", content: egoTab },
    ],
    skillSections: [],
    skillsLabel: "Cards",
  };
}
