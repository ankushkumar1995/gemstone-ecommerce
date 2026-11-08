import { cn } from "@/lib/utils";

/**
 * Single source of truth for horizontal page gutters + max width.
 * Every section, the navbar and the footer use this so their left/right
 * edges line up perfectly (symmetric layout).
 */
export function Container({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  /** Optional anchor target (e.g. for "#section" links). */
  id?: string;
}) {
  return (
    <div id={id} className={cn("mx-auto w-full max-w-[90rem] px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}
