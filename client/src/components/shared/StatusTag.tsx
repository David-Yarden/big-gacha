/** "Upcoming" (officially announced, not released yet) and "Limited" (limited banners only) tags. */
export function StatusTag({ kind, className = "" }: { kind: "upcoming" | "limited"; className?: string }) {
  return kind === "upcoming" ? (
    <span className={`rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow ${className}`}>Upcoming</span>
  ) : (
    <span className={`rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 shadow ${className}`}>Limited</span>
  );
}
