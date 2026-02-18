import { cn } from "@/lib/utils";

interface RarityStarsProps {
  rarity: number;
  className?: string;
}

const RARITY_TEXT_COLOR: Record<number, string> = {
  5: "text-rarity-5",
  4: "text-rarity-4",
  3: "text-rarity-3",
  2: "text-rarity-2",
  1: "text-rarity-1",
};

export function RarityStars({ rarity, className }: RarityStarsProps) {
  return (
    <span className={cn(RARITY_TEXT_COLOR[rarity] ?? "text-muted-foreground", className)}>
      {"★".repeat(rarity)}
    </span>
  );
}
