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
  const isFetching = useRef(false);

  // Stringify deps for stable comparison
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resetKey = JSON.stringify([...resetDeps, limit]);

  // Reset when filters/search change
  useEffect(() => {
    setItems([]);
    setTotal(0);
    setPage(1);
    setTotalPages(1);
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Fetch whenever page or resetKey changes
  useEffect(() => {
    if (isFetching.current) return;
    isFetching.current = true;
    setLoading(true);
    fetcherRef.current(page)
      .then((r) => {
        setItems((prev) => (page === 1 ? r.data : [...prev, ...r.data]));
        setTotal(r.total);
        setTotalPages(r.totalPages);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error loading data"))
      .finally(() => {
        setLoading(false);
        isFetching.current = false;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, resetKey]);

  const hasMore = page < totalPages;

  // IntersectionObserver triggers next page when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetching.current) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore]);

  return { items, total, loading, error, hasMore, sentinelRef };
}
