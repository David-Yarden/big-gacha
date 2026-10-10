/**
 * "Import from my account": reads the characters of the player's in-game showcase on
 * Enka.Network (Genshin, HSR, ZZZ) and starts the planner from their real levels.
 * Planned characters are updated; the other showcase characters can be added in one click.
 */
import { useState } from "react";
import { Download, Loader2, Plus } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { getAccount, type ShowcaseCharacter } from "@/lib/api";
import { gameUi } from "@/lib/gameUi";
import type { Game } from "@/lib/types";

export const ACCOUNT_GAMES = new Set(["genshin", "hsr", "zzz"]);

interface Props {
  game: Game;
  uid?: string;
  planned: string[];
  /** Planned characters found in the showcase: update them. Returns how many changed. */
  onUpdate: (found: ShowcaseCharacter[]) => number;
  onAdd: (found: ShowcaseCharacter[]) => void;
  onUid: (uid: string) => void;
}

export function AccountImport({ game, uid: savedUid, planned, onUpdate, onAdd, onUid }: Props) {
  const [uid, setUid] = useState(savedUid ?? "");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [others, setOthers] = useState<ShowcaseCharacter[]>([]);
  const ui = gameUi(game);

  const run = async () => {
    const id = uid.trim();
    if (!/^\d{9,10}$/.test(id)) {
      setState("error");
      setMessage("A UID has 9 or 10 digits.");
      return;
    }
    setState("loading");
    try {
      const res = await getAccount(game, id);
      const list = res.data.characters;
      onUid(id);
      const updated = onUpdate(list.filter((c) => planned.includes(c.character)));
      setOthers(list.filter((c) => !planned.includes(c.character)));
      setState("done");
      setMessage(
        list.length
          ? `${res.data.nickname ? `${res.data.nickname} · ` : ""}${list.length} in the showcase, ${updated} updated`
          : "No character in this player's in-game showcase."
      );
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setState("error");
      setMessage(status === 404 ? "Player not found." : "Enka.Network is not answering, try again later.");
    }
  };

  return (
    <div className="rounded-lg border bg-muted/10 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Import from my account</span>
        <input
          value={uid}
          onChange={(e) => setUid(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="UID"
          inputMode="numeric"
          className="w-32 rounded-md border bg-background px-2 py-1 font-mono text-sm"
          aria-label="UID"
        />
        <button
          type="button"
          onClick={run}
          disabled={state === "loading"}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-sm transition-colors hover:bg-muted disabled:opacity-50"
        >
          {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Import
        </button>
        {message && <span className={`text-xs ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>{message}</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Reads the characters shown in your in-game showcase (levels, skills, weapon) · data: <a className="underline" href="https://enka.network" target="_blank" rel="noreferrer">Enka.Network</a>
      </p>
      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-muted-foreground">Not planned yet:</span>
          {others.map((c) => (
            <button
              key={c.character}
              type="button"
              onClick={() => {
                onAdd([c]);
                setOthers((o) => o.filter((x) => x.character !== c.character));
              }}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
              title={`Lv. ${c.level}`}
            >
              {c.images && <ImageWithFallback src={ui.portrait(c.images)} alt="" className="h-4 w-4 rounded-full object-cover object-top" />}
              <Plus className="h-3 w-3" />
              {c.displayName ?? c.character}
            </button>
          ))}
          {others.length > 1 && (
            <button
              type="button"
              onClick={() => {
                onAdd(others);
                setOthers([]);
              }}
              className="rounded-full px-2 py-0.5 text-xs text-primary hover:underline"
            >
              Add all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
