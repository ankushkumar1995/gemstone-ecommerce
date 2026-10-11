"use client";

/**
 * ActionMenu — a kebab (⋯) dropdown for per-row actions in the DataTable
 * (View / Edit / Delete …). Shared so row actions look identical everywhere.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Action {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  danger?: boolean;
}

export function ActionMenu({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Actions"
        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.06]"
        style={{ color: "var(--a-muted)" }}
      >
        <MoreHorizontal size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border p-1.5 shadow-xl"
            style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
          >
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={() => {
                  a.onClick();
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  a.danger
                    ? "text-rose-600 hover:bg-rose-500/10"
                    : "hover:bg-black/[0.04]"
                )}
                style={a.danger ? undefined : { color: "var(--a-fg)" }}
              >
                {a.icon && <a.icon size={15} />}
                {a.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
