import { useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { viaCache } from "@/components/shared/ImageWithFallback";

interface RarityStarsProps {
  rarity: number;
  className?: string;
  /** ZZZ only: the large "S RANK" agent badge instead of the round item rank icon */
  badge?: boolean;
}

const RARITY_TEXT_COLOR: Record<number, string> = {
  // 6★ (Endfield): orange → red gradient, set apart from the 5★ gold
  6: "bg-gradient-to-r from-rarity-5 to-rarity-6 bg-clip-text text-transparent tracking-[-0.08em]",
  5: "text-rarity-5",
  4: "text-rarity-4",
  3: "text-rarity-3",
  2: "text-rarity-2",
  1: "text-rarity-1",
};

// ZZZ ranks instead of stars (stored on the same 5/4/3 scale)
const RANK_LETTER: Record<number, string> = { 5: "S", 4: "A", 3: "B", 2: "C" };

// Game rank icons (ZZZ wiki uploads; served through the local image cache, the wiki blocks hotlinks)
const WIKI = "https://static.wikia.nocookie.net/zenless-zone-zero/images";
const ITEM_RANK_ICON: Record<number, string> = {
  5: `${WIKI}/b/bf/Icon_Item_Rank_S.png`,
  4: `${WIKI}/4/45/Icon_Item_Rank_A.png`,
  3: `${WIKI}/4/47/Icon_Item_Rank_B.png`,
};
const AGENT_RANK_ICON: Record<number, string> = {
  5: `${WIKI}/d/d0/Icon_AgentRank_S.png`,
  4: `${WIKI}/5/5c/Icon_AgentRank_A.png`,
};

/** Text colour class of a rarity (stars). */
export function rarityTextClass(rarity: number): string {
  return RARITY_TEXT_COLOR[rarity] ?? "text-muted-foreground";
}

/** Rarity label of a game: ★★★★★, or the rank letter for ZZZ. */
export function rarityLabel(game: string | undefined, rarity: number): string {
  return game === "zzz" ? `${RANK_LETTER[rarity] ?? rarity}-Rank` : "★".repeat(rarity);
}

/** Round rank icon (S/A/B) for ZZZ, e.g. for filter chips; undefined elsewhere. */
export function rankIcon(game: string | undefined, rarity: number): string | undefined {
  return game === "zzz" && ITEM_RANK_ICON[rarity] ? viaCache(ITEM_RANK_ICON[rarity]) ?? undefined : undefined;
}

export function RarityStars({ rarity, className, badge }: RarityStarsProps) {
  const { game } = useParams<{ game: string }>();
  const color = RARITY_TEXT_COLOR[rarity] ?? "text-muted-foreground";
  if (game === "zzz") {
    const label = rarityLabel(game, rarity);
    const src = badge ? AGENT_RANK_ICON[rarity] ?? ITEM_RANK_ICON[rarity] : ITEM_RANK_ICON[rarity];
    if (src) {
      return (
        <span className={cn("inline-flex items-center", className)} title={label}>
          <img
            src={viaCache(src) ?? src}
            alt={label}
            draggable={false}
            className={cn("object-contain", badge ? "h-[2.2em] w-auto" : "h-[1.5em] w-[1.5em]")}
          />
        </span>
      );
    }
    return (
      <span className={cn(color, "font-black italic tracking-tight", className)} title={label}>
        {RANK_LETTER[rarity] ?? rarity}
      </span>
    );
  }
  return <span className={cn(color, className)}>{"★".repeat(rarity)}</span>;
}
