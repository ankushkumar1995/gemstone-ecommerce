import { cn } from "@/lib/utils";

/**
 * Mock gemstone visual. Renders a faceted, glowing "stone" using the
 * product's gradient — a stand-in for real product photography.
 */
export function GemVisual({
  gradient,
  className,
}: {
  gradient: string;
  className?: string;
}) {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* glow */}
      <div
        className="absolute h-2/3 w-2/3 rounded-full blur-3xl opacity-60"
        style={{ background: gradient }}
      />
      {/* faceted gem */}
      <div
        className="relative h-28 w-28 rotate-45 overflow-hidden rounded-[28%] shadow-2xl"
        style={{ background: gradient }}
      >
        {/* facet highlights */}
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg,rgba(255,255,255,0.5),transparent_25%,rgba(255,255,255,0.25)_50%,transparent_75%,rgba(255,255,255,0.4))] mix-blend-overlay" />
        <div className="absolute left-0 top-0 h-1/2 w-full bg-gradient-to-b from-white/40 to-transparent" />
        <div className="absolute inset-x-[18%] inset-y-[18%] rounded-[22%] border border-white/30" />
      </div>
    </div>
  );
}
