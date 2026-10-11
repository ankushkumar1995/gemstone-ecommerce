"use client";

/**
 * Admin overlays — Modal, Drawer and ConfirmDialog. Shared so every page that
 * needs a form or confirmation uses the same premium, animated surface.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import { AdminButton } from "./ui";
import { cn } from "@/lib/utils";

function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

/* ---------------- Modal (centered) ---------------- */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useLockScroll(open);
  useEscape(open, onClose);

  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className={cn(
                "max-h-[90vh] w-full overflow-y-auto rounded-xl border shadow-2xl",
                widths[size]
              )}
              style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
            >
              <div
                className="sticky top-0 flex items-start justify-between gap-4 border-b px-6 py-4 backdrop-blur-xl"
                style={{
                  borderColor: "var(--a-border)",
                  background: "color-mix(in srgb, var(--a-surface) 90%, transparent)",
                }}
              >
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="mt-0.5 text-sm" style={{ color: "var(--a-muted)" }}>
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.04]"
                  style={{ color: "var(--a-muted)" }}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Drawer (right slide-over) ---------------- */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useLockScroll(open);
  useEscape(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l shadow-2xl"
            style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
          >
            <div
              className="flex items-start justify-between gap-4 border-b px-6 py-4"
              style={{ borderColor: "var(--a-border)" }}
            >
              <div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>
                  {title}
                </h3>
                {subtitle && (
                  <p className="mt-0.5 text-sm" style={{ color: "var(--a-muted)" }}>
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.04]"
                style={{ color: "var(--a-muted)" }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
            {footer && (
              <div className="border-t p-4" style={{ borderColor: "var(--a-border)" }}>
                {footer}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------------- ConfirmDialog ---------------- */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  danger = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  useEscape(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="w-full max-w-sm rounded-xl border p-6 text-center shadow-2xl"
              style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
            >
              <span
                className={cn(
                  "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
                  danger ? "bg-rose-500/12 text-rose-600" : "bg-[var(--a-gold-soft)] text-[var(--a-gold)]"
                )}
              >
                <AlertTriangle size={22} />
              </span>
              <h3 className="mt-4 text-lg font-semibold" style={{ color: "var(--a-fg)" }}>
                {title}
              </h3>
              <p className="mt-1.5 text-sm" style={{ color: "var(--a-muted)" }}>
                {message}
              </p>
              <div className="mt-6 flex gap-3">
                <AdminButton variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </AdminButton>
                <AdminButton
                  variant={danger ? "danger" : "primary"}
                  className="flex-1"
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                >
                  {confirmLabel}
                </AdminButton>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
