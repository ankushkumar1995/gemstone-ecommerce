import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string; // last crumb usually has no href
}

/**
 * Shared breadcrumb trail. Pass an ordered list of crumbs; the last one is
 * rendered as the current (non-link) page.
 */
export function Breadcrumb({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-sm text-muted", className)}
    >
      <Link
        href="/"
        className="flex items-center gap-1 transition-colors hover:text-gold-600"
      >
        <Home size={14} />
        <span className="sr-only sm:not-sr-only">Home</span>
      </Link>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight size={14} className="text-foreground/30" />
            {item.href && !last ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-gold-600"
              >
                {item.label}
              </Link>
            ) : (
              <span className="line-clamp-1 text-foreground">{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
