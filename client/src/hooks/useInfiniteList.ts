import { useState, useEffect, useRef } from "react";
import type { PaginatedResponse } from "@/lib/types";

interface UseInfiniteListResult<T> {
  items: T[];
  total: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  sentinelRef: React.RefObject<HTMLDivElement>;
}

/**
 * Infinite-scroll list hook. Fetches pages and appends results.
 * Resets automatically when resetDeps change (e.g. search/filter params).
 *
 * Each filter state gets a "generation" number: responses that belong to an
 * older generation are dropped, so fast typing or filter clicks can never
 * show results for a previous search.
 */
export function useInfiniteList<T>(
  fetcher: (page: number) => Promise<PaginatedResponse<T>>,
  resetDeps: unknown[],
  limit = 25
): UseInfiniteListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null!);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const generation = useRef(0);
  const inFlight = useRef(false);
  const fetchedKey = useRef<string | null>(null);

  const resetKey = JSON.stringify([...resetDeps, limit]);

  // Reset when filters/search change
  useEffect(() => {
    generation.current++;
    inFlight.current = false;
    setItems([]);
    setTotal(0);
    setPage(1);
    setTotalPages(1);
    setError(null);
  }, [resetKey]);

  // Fetch whenever page or resetKey changes
  useEffect(() => {
    // Filters just changed but `page` still holds the old value: wait for the
    // reset to page 1 instead of fetching a later page of the new results.
    if (fetchedKey.current !== resetKey && page !== 1) return;
    fetchedKey.current = resetKey;
    const gen = generation.current;
    inFlight.current = true;
    setLoading(true);
    fetcherRef.current(page)
      .then((r) => {
        if (gen !== generation.current) return;
        setItems((prev) => (page === 1 ? r.data : [...prev, ...r.data]));
        setTotal(r.total);
        setTotalPages(r.totalPages);
        setError(null);
      })
      .catch((e) => {
        if (gen !== generation.current) return;
        setError(e instanceof Error ? e.message : "Error loading data");
      })
      .finally(() => {
        if (gen !== generation.current) return;
        setLoading(false);
        inFlight.current = false;
      });
  }, [page, resetKey]);

  const hasMore = page < totalPages;

  // IntersectionObserver triggers next page when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !inFlight.current) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, items.length]);

  return { items, total, loading, error, hasMore, sentinelRef };
}
