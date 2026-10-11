import type { ReactNode } from "react";
import type { Game } from "@/lib/types";
import type { SkillSection } from "@/components/character/TotalCostCalculator";

export interface KitTab {
  value: string;
  label: string;
  content: ReactNode;
}

/** What a game's kit contributes to the character page. */
export interface CharacterKit {
  /** Skills tab first, then the duplicates tab (constellations, eidolons, …) */
  tabs: KitTab[];
  /** Per-skill material costs at the selected levels, for the total calculator */
  skillSections: SkillSection[];
  skillsLabel: string;
  /** Extra controls under the header (e.g. the Novaflare version toggle) */
  controls?: ReactNode;
}

export interface KitArgs {
  game: Game;
  name: string;
  /** Selected element / path for multi-element characters (Traveler, Trailblazer, Rover) */
  activeElement: string | null;
  /** The character's element / attribute (CZN: colour of the epiphany strip) */
  element?: string;
}

export type UseKit = (args: KitArgs) => CharacterKit;
