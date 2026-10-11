/**
 * Shuts Big Gacha down (server and site) from the site: first click arms the button, the
 * second confirms. The launcher's notification-area icon does the stopping (launch.ps1).
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Power } from "lucide-react";
import { cn } from "@/lib/utils";

export function PowerButton() {
  const [armed, setArmed] = useState(false);
  const [state, setState] = useState<"idle" | "stopping" | "off" | { error: string }>("idle");

  // Disarm after a few seconds without the confirming click
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  async function shutdown() {
    setState("stopping");
    try {
      const res = await fetch("/api/admin/shutdown", { method: "POST", headers: { "X-Big-Gacha": "1" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setTimeout(() => setState("off"), 2500);
    } catch (err) {
      setState({ error: (err as Error).message });
      setArmed(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (armed ? shutdown() : setArmed(true))}
        className={cn(
          "flex items-center gap-1.5 rounded-md p-2 text-sm transition-colors",
          armed ? "bg-destructive/90 px-2.5 text-white hover:bg-destructive" : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        title={armed ? "Click again to shut down" : "Shut down Big Gacha"}
        aria-label={armed ? "Click again to shut down" : "Shut down Big Gacha"}
      >
        <Power className="h-4 w-4" />
        {armed && <span className="font-medium">Shut down?</span>}
      </button>

      {state !== "idle" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6 text-center backdrop-blur">
            <div className="max-w-sm space-y-3">
              <img src="/BIG_GACHA_LOGO.png" alt="" className="mx-auto h-20 w-20 object-contain opacity-80" />
              {state === "stopping" && <p className="text-lg font-semibold">Shutting down Big Gacha…</p>}
              {state === "off" && (
                <>
                  <p className="text-lg font-semibold">Big Gacha is off.</p>
                  <p className="text-sm text-muted-foreground">You can close this tab. Start it again from its shortcut.</p>
                </>
              )}
              {typeof state === "object" && (
                <>
                  <p className="text-lg font-semibold">Could not shut down</p>
                  <p className="text-sm text-muted-foreground">{state.error}</p>
                  <button type="button" onClick={() => setState("idle")} className="text-sm text-primary hover:underline">
                    Back
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
