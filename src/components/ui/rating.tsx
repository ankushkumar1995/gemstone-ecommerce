import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  reviews,
  size = 14,
  className,
}: {
  value: number;
  reviews?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i + 1 <= Math.round(value);
          return (
            <Star
              key={i}
              size={size}
              className={cn(
                filled ? "fill-gold-400 text-gold-400" : "text-foreground/20"
              )}
            />
          );
        })}
      </div>
      <span className="text-xs font-medium text-foreground">
        {value.toFixed(1)}
      </span>
      {reviews !== undefined && (
        <span className="text-xs text-muted">({reviews})</span>
      )}
    </div>
  );
}
