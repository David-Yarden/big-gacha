import { useGenshinKit } from "./genshin";
import { useHsrKit } from "./hsr";
import { useWuwaKit } from "./wuwa";
import { useZzzKit } from "./zzz";
import { useEndfieldKit } from "./endfield";
import type { UseKit } from "./types";

/** Character kit per game. A new game = a new hook here. */
export const KITS: Partial<Record<string, UseKit>> = {
  genshin: useGenshinKit,
  hsr: useHsrKit,
  wuwa: useWuwaKit,
  zzz: useZzzKit,
  endfield: useEndfieldKit,
};

/** Game without a kit yet: the page shows the header and level panel only. */
export const useNoKit: UseKit = () => ({ tabs: [], skillSections: [], skillsLabel: "Skills" });

export type { CharacterKit, KitTab } from "./types";
