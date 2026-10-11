/**
 * Persona builder (Chaos Zero Nightmare, season 3): a Persona card takes up to two
 * engravings, Lux or Umbra. The engravings offered depend on the card's type and on the
 * combatant's class; the card picture follows the Lux / Umbra mix, and the engravings'
 * modifiers change the cost and add keywords.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { CardFace } from "@/components/czn/CardFace";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getReference } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface PersonaBase {
  name: string;
  cost?: number;
  type?: string;
  desc?: string;
  image?: string;
  classes?: string[];
}
export interface Engraving {
  id: string;
  eidolon: "Lux" | "Umbra" | string;
  type: string;
  modifiers: string[];
  classes?: string[];
  text: string;
}
export interface PersonaTables {
  images: Record<string, string>;
  engravings: Engraving[];
}

const EIDOLON_COLOR: Record<string, string> = { Lux: "#ffd66b", Umbra: "#b48cff" };
const plain = (t: string) => t.replace(/\*\*([^*]+)\*\*/g, "[$1]");

/** Picture of the Persona for a Lux / Umbra mix (as the game shows it). */
function imageKey(chosen: Engraving[]) {
  const lux = chosen.filter((e) => e.eidolon === "Lux").length;
  const umbra = chosen.filter((e) => e.eidolon === "Umbra").length;
  if (lux >= 2) return "all_lux";
  if (umbra >= 2) return "all_umbra";
  if (lux && umbra) return "lux_and_umbra";
  if (lux) return "half_lux";
  if (umbra) return "half_umbra";
  return null;
}

export function usePersonaTables() {
  const { data } = useApiQuery(() => getReference("czn" as never, "Persona"), []);
  return data?.data?.data as PersonaTables | undefined;
}

/** The Persona card as built from its engravings: cost, keywords, picture and added lines. */
export function personaFace(base: PersonaBase, chosen: Engraving[], tables?: PersonaTables) {
  let cost = base.cost ?? 0;
  const keywords: string[] = [];
  for (const m of chosen.flatMap((e) => e.modifiers)) {
    const c = m.match(/^Cost ([+-]\d+)$/i);
    if (c) cost += Number(c[1]);
    else keywords.push(m);
  }
  const key = imageKey(chosen);
  const image = (key && tables?.images[key]) || base.image;
  const desc = `${keywords.map((k) => `**${k}**`).join("")}${base.desc ?? ""}`;
  return { card: { name: base.name, cost: Math.max(0, cost), type: base.type, desc, image, rarity: "Rare" }, extra: chosen.map((e) => e.text) };
}

export interface PersonaChoice {
  engravings: [string | null, string | null];
  personaClass: string | null;
}

export function PersonaBuilder({
  base,
  classes,
  initial,
  onChange,
}: {
  base: PersonaBase;
  classes: string[];
  initial?: Partial<PersonaChoice>;
  onChange?: (choice: PersonaChoice) => void;
}) {
  const tables = usePersonaTables();
  const allowed = base.classes?.length ? base.classes : classes;
  const [cls, setCls] = useState<string | null>(initial?.personaClass ?? (allowed.length === 1 ? allowed[0] : null));
  const [slots, setSlots] = useState<[string | null, string | null]>(initial?.engravings ?? [null, null]);
  const [active, setActive] = useState<0 | 1>(0);

  const report = useRef(onChange);
  report.current = onChange;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    report.current?.({ engravings: slots, personaClass: cls });
  }, [slots, cls]);

  const offered = useMemo(
    () => (tables?.engravings ?? []).filter((e) => e.type === base.type && (!cls || !e.classes || e.classes.includes(cls))),
    [tables, base.type, cls]
  );
  const chosen = slots.map((id) => offered.find((e) => e.id === id) ?? null).filter((e): e is Engraving => !!e);

  // Modifiers: "Cost +1" changes the cost, the others are keywords on top of the text
  const face = personaFace(base, chosen, tables);

  const pick = (id: string) => {
    const next: [string | null, string | null] = [...slots];
    next[active] = next[active] === id ? null : id;
    setSlots(next);
    if (next[active] && active === 0 && !next[1]) setActive(1);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <div className="space-y-2">
        <CardFace card={face.card} extra={face.extra} />
        <p className="text-center text-xs text-muted-foreground">{chosen.length ? chosen.map((e) => e.eidolon).join(" + ") : "No engraving"}</p>
      </div>

      <div className="min-w-0 space-y-4">
        {allowed.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Combatant class</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!cls} onClick={() => setCls(null)}>
                Any
              </Chip>
              {allowed.map((c) => (
                <Chip key={c} active={cls === c} onClick={() => setCls(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((i) => {
            const e = chosen.find((x) => x.id === slots[i]);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i as 0 | 1)}
                className={cn("rounded-lg border p-2 text-left text-xs", active === i ? "border-primary bg-primary/10" : "border-white/10 hover:bg-white/5")}
              >
                <span className="block font-semibold">{`Engraving ${i + 1}`}</span>
                <span className="text-muted-foreground">{e ? `${e.eidolon} · ${plain(e.text)}` : "Empty"}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold">{`${offered.length} engravings for a ${base.type ?? ""} Persona`}</p>
          <ul className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-1">
            {offered.map((e) => {
              const inOther = slots[active === 0 ? 1 : 0] === e.id;
              const selected = slots[active] === e.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={inOther}
                    onClick={() => pick(e.id)}
                    className={cn("flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-40", selected ? "bg-primary/20" : "hover:bg-white/5")}
                  >
                    <span className="mt-0.5 shrink-0 rounded px-1.5 text-[11px] font-semibold text-black" style={{ background: EIDOLON_COLOR[e.eidolon] ?? "#ccc" }}>
                      {e.eidolon}
                    </span>
                    <span className="flex-1">
                      {plain(e.text)}
                      {e.modifiers.length > 0 && <span className="ml-1 text-amber-300">{`(${e.modifiers.join(", ")})`}</span>}
                    </span>
                    {e.classes && <span className="shrink-0 text-[11px] text-muted-foreground">{e.classes.join(", ")}</span>}
                    {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
            {!tables && <li className="px-2 py-3 text-sm text-muted-foreground">Loading…</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-full border px-2.5 py-1 text-xs", active ? "border-transparent bg-white/15" : "border-white/10 hover:bg-white/10")}
    >
      {children}
    </button>
  );
}
