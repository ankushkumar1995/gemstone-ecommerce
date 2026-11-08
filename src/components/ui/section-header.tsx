import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className
      )}
    >
      {eyebrow && (
        <div
          className={cn(
            "mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-500",
            align === "center" && "justify-center"
          )}
        >
          <span className="h-px w-6 bg-gradient-to-r from-transparent to-gold-400" />
          {eyebrow}
          <span className="h-px w-6 bg-gradient-to-l from-transparent to-gold-400" />
        </div>
      )}
      <h2 className="font-display text-[1.5rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[1.75rem] md:text-[1.875rem]">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
          {description}
        </p>
      )}
    </Reveal>
  );
}
