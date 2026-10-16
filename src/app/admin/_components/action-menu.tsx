"use client";

/**
 * ActionMenu — a kebab (⋯) dropdown for per-row actions in the DataTable.
 *
 * The menu is rendered in a portal and positioned next to the trigger so it is
 * NEVER clipped by the table's overflow containers (a common bug with a single
 * row or the last row). It flips upward automatically if there isn't room
 * below, closes on outside-click / Escape / scroll, and supports disabled +
 * dividers + danger items.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Action {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** render a divider line above this item */
  separated?: boolean;
}

export function ActionMenu({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const MENU_WIDTH = 192; // w-48
  const estHeight = actions.length * 40 + 12;

  const place = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < estHeight + 12 && r.top > estHeight;
    setCoords({
      top: openUp ? r.top - estHeight - 4 : r.bottom + 4,
      left: Math.max(8, r.right - MENU_WIDTH),
      openUp,
    });
  };

  useLayoutEffect(() => {
    if (open) place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.06]"
        style={{ color: "var(--a-muted)" }}
      >
        <MoreHorizontal size={18} />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          // Wrap in `admin-root` so the admin CSS variables (which are scoped to
          // that class) resolve — the portal lives on <body>, outside the admin
          // layout, so without this the background would be transparent.
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: coords.openUp ? 6 : -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: coords.openUp ? 6 : -6, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="fixed z-[80] h-max w-48 overflow-hidden rounded-xl border p-1.5 shadow-xl"
                style={{ top: coords.top, left: coords.left, background: "#ffffff", borderColor: "rgba(20,20,40,0.12)" }}
                onClick={(e) => e.stopPropagation()}
              >
                {actions.map((a) => (
                  <div key={a.label}>
                    {a.separated && (
                      <div className="my-1 border-t" style={{ borderColor: "rgba(20,20,40,0.08)" }} />
                    )}
                    <button
                      disabled={a.disabled}
                      onClick={() => {
                        if (a.disabled) return;
                        a.onClick();
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                        a.disabled
                          ? "cursor-not-allowed opacity-40"
                          : a.danger
                            ? "text-rose-600 hover:bg-rose-500/10"
                            : "text-[#1a1733] hover:bg-black/[0.04]",
                      )}
                    >
                      {a.icon && <a.icon size={15} />}
                      {a.label}
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
