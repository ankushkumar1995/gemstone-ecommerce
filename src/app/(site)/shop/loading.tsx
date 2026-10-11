import { Skeleton, ProductGridSkeleton } from "@/components/ui/skeleton";

export default function ShopLoading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-10 w-72" />

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* sidebar */}
        <aside className="hidden lg:block">
          <div className="space-y-6 rounded-2xl border border-foreground/10 bg-nebula p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-8 w-20 rounded-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <ProductGridSkeleton count={9} />
      </div>
    </div>
  );
}
