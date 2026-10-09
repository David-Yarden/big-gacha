import { useCallback, useEffect, useState } from "react";
import { getSyncStatus } from "@/lib/api";
import type { SyncStatus } from "@/lib/types";

const listeners = new Set<(s: SyncStatus) => void>();
let last: SyncStatus | null = null;

/** Refresh the shared sync status now (e.g. after a manual sync). */
export async function refreshSyncStatus(): Promise<SyncStatus | null> {
  try {
    last = await getSyncStatus();
    listeners.forEach((l) => l(last!));
  } catch {
    /* server not reachable: keep the previous status */
  }
  return last;
}

/**
 * Sync status shared by the navbar badge and the Updates page.
 * Polls every `intervalMs` (faster while a sync is running).
 */
export function useSyncStatus(intervalMs = 60_000) {
  const [status, setStatus] = useState<SyncStatus | null>(last);

  useEffect(() => {
    listeners.add(setStatus);
    refreshSyncStatus();
    return () => {
      listeners.delete(setStatus);
    };
  }, []);

  const running = !!status?.running;
  useEffect(() => {
    const id = setInterval(refreshSyncStatus, running ? 3_000 : intervalMs);
    return () => clearInterval(id);
  }, [running, intervalMs]);

  const refresh = useCallback(() => refreshSyncStatus(), []);
  return { status, refresh };
}
