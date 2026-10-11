"use client";

/**
 * Admin loading skeletons. Shared shimmer placeholders so every page shows a
 * consistent loading state while data is fetched.
 */

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("admin-shimmer relative overflow-hidden rounded-md", className)}
      style={{ background: "var(--a-surface-2)" }}
    />
  );
}

/** Skeleton rows for a DataTable while it loads. */
export function TableSkeleton({
  rows = 6,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--a-border)" }}>
      {/* header */}
      <div
        className="flex gap-4 border-b px-4 py-3"
        style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0"
          style={{ borderColor: "var(--a-border)" }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn("h-4 flex-1", c === 0 && "max-w-[40%]")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton grid of stat cards. */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border p-4"
          style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-6 w-24" />
          <Skeleton className="mt-2 h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}
