import { cn } from "@/lib/utils";

/**
 * Single source of truth for horizontal page gutters + max width.
 * Every section, the navbar and the footer use this so their left/right
 * edges line up perfectly (symmetric layout).
 */
export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}
