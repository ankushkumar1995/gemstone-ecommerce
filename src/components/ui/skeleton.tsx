import { cn } from "@/lib/utils";

/**
 * Base shimmer skeleton block. Uses a subtle animated gradient sweep.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "skeleton-sweep relative overflow-hidden rounded-xl bg-foreground/[0.06]",
        className
      )}
    />
  );
}

/** Skeleton that mirrors a ProductCard while data loads. */
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-nebula">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-20" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** A responsive grid of product-card skeletons. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
