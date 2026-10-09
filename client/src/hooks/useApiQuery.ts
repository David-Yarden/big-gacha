import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch data and re-fetch when `deps` change.
 * Only the most recent request may update state: a slow response for an
 * older search or page can no longer overwrite a newer one.
 */
export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): UseApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const execute = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (id !== requestId.current) return;
      setData(result);
    } catch (err: unknown) {
      if (id !== requestId.current) return;
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
    return () => {
      // Invalidate the in-flight request when deps change or on unmount
      requestId.current++;
    };
  }, [execute]);

  return { data, loading, error, refetch: execute };
}
