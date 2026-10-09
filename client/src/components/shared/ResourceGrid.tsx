import { Skeleton } from "@/components/ui/skeleton";

interface ResourceGridProps {
  loading: boolean;
  empty: boolean;
  emptyMessage?: string;
  skeletonCount?: number;
  /** Override the column classes (default: 2 → 5 columns) */
  columns?: string;
  children: React.ReactNode;
}

const DEFAULT_COLUMNS = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

export function ResourceGrid({
  loading,
  empty,
  emptyMessage = "No results found",
  skeletonCount = 10,
  columns = DEFAULT_COLUMNS,
  children,
}: ResourceGridProps) {
  if (loading) {
    return (
      <div className={`grid gap-3 ${columns}`}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
        <p className="text-lg font-medium">{emptyMessage}</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${columns}`}>
      {children}
    </div>
  );
}
