"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Accessible multi-select chip group. */
export function ChipSelect({ options, value, onChange, max, label }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void; max?: number; label: string }) {
  const toggle = (o: string) => {
    if (value.includes(o)) onChange(value.filter((x) => x !== o));
    else if (!max || value.length < max) onChange([...value, o]);
  };
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        const blocked = !on && !!max && value.length >= max;
        return (
          <button key={o} type="button" aria-pressed={on} disabled={blocked} onClick={() => toggle(o)}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40",
              on ? "border-[var(--a-gold)] bg-[var(--a-gold-soft)] text-[var(--a-gold)]" : "border-[var(--a-border)] text-[var(--a-muted)] hover:border-[var(--a-border-strong)] hover:text-[var(--a-fg)]")}>
            {on && <Check size={13} />}{o}
          </button>
        );
      })}
    </div>
  );
}
