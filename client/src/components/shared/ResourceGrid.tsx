import { Skeleton } from "@/components/ui/skeleton";

interface ResourceGridProps {
  loading: boolean;
  empty: boolean;
  emptyMessage?: string;
  skeletonCount?: number;
  children: React.ReactNode;
}

export function ResourceGrid({
  loading,
  empty,
  emptyMessage = "No results found",
  skeletonCount = 10,
  children,
}: ResourceGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {children}
    </div>
  );
}
