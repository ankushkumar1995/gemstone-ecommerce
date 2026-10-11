import { cn } from "@/lib/utils";

type BadgeTone = "bestseller" | "new" | "limited" | "certified" | "default";

const tones: Record<BadgeTone, string> = {
  bestseller: "bg-gold-400/15 text-gold-600 border-gold-400/40",
  new: "bg-aura/15 text-aura border-aura/40",
  limited: "bg-rose-mystic/15 text-rose-mystic border-rose-mystic/40",
  certified: "bg-royal-400/15 text-royal-600 border-royal-400/40",
  default: "bg-foreground/8 text-foreground border-foreground/15",
};

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-sm",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function badgeTone(badge?: string): BadgeTone {
  switch (badge) {
    case "Bestseller":
      return "bestseller";
    case "New":
      return "new";
    case "Limited":
      return "limited";
    case "Certified":
      return "certified";
    default:
      return "default";
  }
}
