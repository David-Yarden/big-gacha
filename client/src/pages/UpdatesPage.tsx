import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useSyncStatus, refreshSyncStatus } from "@/hooks/useSyncStatus";
import {
  getChangelog,
  getEnhancementStatus,
  markUpdatesSeen,
  reloadEnhancements,
  rollbackSync,
  runSync,
} from "@/lib/api";
import { GAMES } from "@/lib/constants";
import { linksFor } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { ChangelogEntry, ChangelogItem, SyncGameStatus } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ago(iso?: string | null): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function when(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

const gameName = (id: string) => GAMES.find((g) => g.id === id)?.shortName ?? id;

/** Model name → list path of that game ("Character" → "characters"). */
const MODEL_PATH: Record<string, string> = {
  Character: "characters",
  Weapon: "weapons",
  LightCone: "lightcones",
  Artifact: "artifacts",
  Relic: "relics",
  Material: "materials",
  Echo: "echoes",
  EchoSet: "echosets",
};
const MODEL_LABEL: Record<string, string> = {
  Character: "Characters",
  Weapon: "Weapons",
  LightCone: "Light Cones",
  Artifact: "Artifact sets",
  Relic: "Relic sets",
  Material: "Materials",
  Talent: "Talents",
  Constellation: "Constellations",
  Trace: "Traces",
  Eidolon: "Eidolons",
  Echo: "Echoes",
  EchoSet: "Sonata Effects",
  Forte: "Fortes",
  ResonanceChain: "Resonance Chains",
};
// Order in which models are listed (most interesting first)
const MODEL_ORDER = ["Character", "Weapon", "LightCone", "Artifact", "Relic", "Echo", "EchoSet", "Material"];

function groupByModel(items: ChangelogItem[]) {
  const groups = new Map<string, ChangelogItem[]>();
  for (const it of items) groups.set(it.model, [...(groups.get(it.model) ?? []), it]);
  return [...groups.entries()]
    .filter(([model]) => !["Talent", "Constellation", "Trace", "Eidolon", "Forte", "ResonanceChain"].includes(model))
    .sort(([a], [b]) => (MODEL_ORDER.indexOf(a) + 99) % 99 - (MODEL_ORDER.indexOf(b) + 99) % 99);
}

function itemLink(game: string, item: ChangelogItem): string | null {
  const path = MODEL_PATH[item.model];
  if (!path || !linksFor(game).some((l) => l.path === path)) return null;
  return `/${game}/${path}/${encodeURIComponent(item.name)}`;
}

const STATUS_STYLE: Record<string, string> = {
  applied: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "up-to-date": "bg-muted text-muted-foreground border-border",
  failed: "bg-destructive/15 text-destructive border-destructive/40",
  "rolled-back": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "dry-run": "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <Badge variant="outline">not synced yet</Badge>;
  return <Badge variant="outline" className={cn("capitalize", STATUS_STYLE[status])}>{status.replace("-", " ")}</Badge>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function UpdatesPage() {
  const { status } = useSyncStatus();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [version, setVersion] = useState(0); // bump to reload the history

  const { data: changelog, loading: logLoading } = useApiQuery(() => getChangelog(undefined, 40), [version]);
  const { data: enhStatus, refetch: refetchEnh } = useApiQuery(() => getEnhancementStatus(), [version]);

  // Opening this page clears the navbar badge
  useEffect(() => {
    markUpdatesSeen().then(refreshSyncStatus).catch(() => {});
  }, []);

  const lastApplied = useMemo(() => {
    const map = new Map<string, ChangelogEntry>();
    for (const e of changelog?.data ?? []) if (e.status === "applied" && e.backup && !map.has(e.game)) map.set(e.game, e);
    return map;
  }, [changelog]);

  async function act(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMessage(null);
    try {
      setMessage({ kind: "ok", text: await fn() });
    } catch (err) {
      const text = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? (err as Error).message;
      setMessage({ kind: "error", text });
    } finally {
      setBusy(null);
      setVersion((v) => v + 1);
      refreshSyncStatus();
    }
  }

  const check = (game: string) =>
    act(`sync-${game}`, async () => {
      const reports = await runSync(game);
      return reports
        .map((r) =>
          r.status === "applied"
            ? `${gameName(r.game)}: +${r.added?.length ?? 0} new, ${r.changed?.length ?? 0} updated`
            : r.status === "failed"
            ? `${gameName(r.game)}: failed — ${r.errors?.[0] ?? "see history"}`
            : `${gameName(r.game)}: ${r.status}`
        )
        .join(" · ");
    });

  const rollback = (game: string) => {
    if (!window.confirm(`Undo the last ${gameName(game)} update? The data goes back to the automatic backup taken before it.`)) return;
    act(`rollback-${game}`, async () => {
      await rollbackSync(game);
      return `${gameName(game)}: last update undone`;
    });
  };

  const scheduler = status?.scheduler;

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Updates</h1>
          <p className="text-sm text-muted-foreground">
            {scheduler?.enabled
              ? `Checked automatically at start-up and every ${scheduler.intervalHours} h while the app runs${
                  scheduler.nextRunAt ? ` · next check ${when(scheduler.nextRunAt)}` : ""
                }.`
              : "Automatic checks are disabled (SYNC_AUTO=false)."}
          </p>
        </div>
        <Button onClick={() => check("all")} disabled={!!busy || !!status?.running} className="gap-2">
          {busy === "sync-all" || status?.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {status?.running ? `Syncing ${gameName(status.running)}…` : "Check all now"}
        </Button>
      </div>

      {message && (
        <div
          className={cn(
            "rounded-lg border p-3 text-sm",
            message.kind === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-destructive/50 bg-destructive/10 text-destructive"
          )}
        >
          {message.text}
        </div>
      )}

      {/* Games */}
      <section className="grid gap-4 md:grid-cols-3">
        {(status?.data ?? []).map((g) => (
          <GameCard
            key={g.game}
            g={g}
            busy={busy}
            running={status?.running ?? null}
            canRollback={lastApplied.has(g.game)}
            onCheck={() => check(g.game)}
            onRollback={() => rollback(g.game)}
          />
        ))}
      </section>

      {/* Enhancement files */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-amber-400" /> Kit enhancement files
          </h2>
          <Button
            variant="outline"
            size="sm"
            disabled={!!busy}
            onClick={() =>
              act("enh", async () => {
                const r = await reloadEnhancements();
                refetchEnh();
                return r.data.errors.length ? `${r.data.errors.length} error(s) in enhancement files` : "Enhancement files reloaded";
              })
            }
          >
            {busy === "enh" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reload files"}
          </Button>
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {(enhStatus?.data.files ?? []).map((f) => (
                <Badge
                  key={f.file}
                  variant="outline"
                  className={f.status === "loaded" ? "border-emerald-500/30 text-emerald-300" : "border-destructive/50 text-destructive"}
                >
                  {f.file} · {f.status === "loaded" ? `${f.entries} entries` : `${f.errors} error(s)`}
                </Badge>
              ))}
            </div>
            {enhStatus?.data.errors.length ? (
              <ul className="space-y-1 text-sm text-destructive">
                {enhStatus.data.errors.map((e) => (
                  <li key={e} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {e}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Files live in <code>shared/games/&lt;game&gt;/enhancements/</code> — format in <code>shared/games/README.md</code>.
                Loaded {ago(enhStatus?.data.loadedAt)}.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* History */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">History</h2>
        {logLoading && !changelog && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {changelog && changelog.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No update recorded yet.</p>
        )}
        <div className="space-y-2">
          {(changelog?.data ?? []).map((e) => (
            <HistoryEntry key={e._id} e={e} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Game status card ──────────────────────────────────────────────────────────

function GameCard({
  g,
  busy,
  running,
  canRollback,
  onCheck,
  onRollback,
}: {
  g: SyncGameStatus;
  busy: string | null;
  running: string | null;
  canRollback: boolean;
  onCheck: () => void;
  onRollback: () => void;
}) {
  const isRunning = running === g.game || busy === `sync-${g.game}` || busy === "sync-all";
  return (
    <Card className={cn(g.lastStatus === "failed" && "border-destructive/50")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{g.name}</h3>
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <StatusBadge status={g.lastStatus} />}
        </div>

        {g.syncable ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Game version</dt>
            <dd className="font-medium">{g.gameVersion ?? "—"}</dd>
            <dt className="text-muted-foreground">Source</dt>
            <dd className="truncate" title={g.source ?? ""}>{g.source}</dd>
            <dt className="text-muted-foreground">Source version</dt>
            <dd className="font-mono text-xs leading-5">{g.upstreamVersion ?? "—"}</dd>
            <dt className="text-muted-foreground">Last check</dt>
            <dd title={when(g.lastCheckAt)}>{ago(g.lastCheckAt)}</dd>
            <dt className="text-muted-foreground">Last change</dt>
            <dd title={when(g.lastSyncAt)}>{ago(g.lastSyncAt)}</dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No automatic source yet for this game.</p>
        )}

        {g.lastError && (
          <p className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {g.lastError}
          </p>
        )}

        {g.syncable && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" disabled={!!busy || !!running} onClick={onCheck}>
              <RefreshCw className="h-3.5 w-3.5" /> Check now
            </Button>
            {canRollback && (
              <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" disabled={!!busy || !!running} onClick={onRollback}>
                <RotateCcw className="h-3.5 w-3.5" /> Undo last
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── History entry ─────────────────────────────────────────────────────────────

function HistoryEntry({ e }: { e: ChangelogEntry }) {
  const [open, setOpen] = useState(false);
  const added = groupByModel(e.added);
  const changedMain = e.changed.filter((c) => MODEL_PATH[c.model]);
  const headline =
    e.status === "failed"
      ? e.problems?.[0] ?? "Failed"
      : [
          ...added.slice(0, 3).map(([m, list]) => `+${list.length} ${MODEL_LABEL[m]?.toLowerCase() ?? m}`),
          e.changed.length ? `${e.changed.length} updated` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "No visible change";

  return (
    <Card>
      <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {e.status === "failed" ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className={cn("h-4 w-4 shrink-0", e.status === "rolled-back" ? "text-amber-400" : "text-emerald-400")} />
        )}
        <span className="w-16 shrink-0 text-sm font-semibold">{gameName(e.game)}</span>
        {e.gameVersion && <Badge variant="outline" className="shrink-0">{e.gameVersion}</Badge>}
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{headline}</span>
        <StatusBadge status={e.status} />
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{when(e.createdAt)}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <CardContent className="space-y-4 border-t p-4 text-sm">
          {e.problems?.length ? (
            <ul className="space-y-1 text-destructive">
              {e.problems.map((p) => <li key={p}>• {p}</li>)}
            </ul>
          ) : null}
          {e.warnings?.length ? (
            <ul className="space-y-1 text-amber-300">
              {e.warnings.map((w) => <li key={w}>• {w}</li>)}
            </ul>
          ) : null}

          {added.map(([model, list]) => (
            <div key={model}>
              <h4 className="mb-1.5 font-medium">
                New {MODEL_LABEL[model]?.toLowerCase() ?? model} <span className="text-muted-foreground">({list.length})</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {list.slice(0, model === "Material" ? 40 : 200).map((it) => {
                  const to = itemLink(e.game, it);
                  return to ? (
                    <Link key={it.name} to={to} className="rounded-md border px-2 py-0.5 text-xs hover:border-primary/50 hover:text-primary">
                      {it.name}
                    </Link>
                  ) : (
                    <span key={it.name} className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">{it.name}</span>
                  );
                })}
                {model === "Material" && list.length > 40 && (
                  <span className="px-2 py-0.5 text-xs text-muted-foreground">+{list.length - 40} more</span>
                )}
              </div>
            </div>
          ))}

          {changedMain.length > 0 && (
            <div>
              <h4 className="mb-1.5 font-medium">
                Updated <span className="text-muted-foreground">({e.changed.length} documents, main ones below)</span>
              </h4>
              <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                {changedMain.slice(0, 30).map((c) => (
                  <li key={`${c.model}-${c.name}`} className="truncate text-xs">
                    <span className="text-foreground">{c.name}</span>{" "}
                    <span className="text-muted-foreground">— {c.fields?.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Source {e.upstreamBefore ?? "—"} → {e.upstreamAfter ?? "—"}
            {e.missing?.length ? ` · ${e.missing.length} entries no longer in the source (kept)` : ""}
            {e.backup ? ` · backup ${e.backup}` : ""}
            {e.durationMs ? ` · ${(e.durationMs / 1000).toFixed(1)} s` : ""}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
