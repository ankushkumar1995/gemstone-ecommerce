"use client";

/**
 * Admin toast system — scoped to the admin area (separate from the storefront
 * toasts). Provider mounts a stacked, animated list; `useAdminToast().toast()`
 * fires feedback like "Saved", "Deleted" from any action.
 *
 * Premium look: gradient icon chip, left accent bar, tinted background per
 * variant, title (+ optional description), and an auto-dismiss progress bar.
 * Rendered in a portal on <body> so no ancestor transform can shift/clip it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

type Variant = "success" | "info" | "error";
interface Toast {
  id: number;
  message: string;
  description?: string;
  variant: Variant;
  duration: number;
}

const ToastCtx = createContext<{
  toast: (m: string, v?: Variant, opts?: { description?: string; duration?: number }) => void;
} | null>(null);

const DEFAULT_DURATION = 3600;

/** Per-variant visual theme (solid colours — portal lives outside .admin-root). */
const THEME: Record<
  Variant,
  { Icon: React.ElementType; accent: string; grad: string; tint: string; ring: string }
> = {
  success: {
    Icon: CheckCircle2,
    accent: "#10b981",
    grad: "linear-gradient(135deg,#34d399,#059669)",
    tint: "rgba(16,185,129,0.08)",
    ring: "rgba(16,185,129,0.35)",
  },
  info: {
    Icon: Info,
    accent: "#0ea5e9",
    grad: "linear-gradient(135deg,#38bdf8,#0284c7)",
    tint: "rgba(14,165,233,0.08)",
    ring: "rgba(14,165,233,0.35)",
  },
  error: {
    Icon: AlertTriangle,
    accent: "#f43f5e",
    grad: "linear-gradient(135deg,#fb7185,#e11d48)",
    tint: "rgba(244,63,94,0.08)",
    ring: "rgba(244,63,94,0.35)",
  },
};

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(0);

  useEffect(() => setMounted(true), []);

  const remove = useCallback(
    (id: number) => setToasts((l) => l.filter((t) => t.id !== id)),
    [],
  );
  const toast = useCallback(
    (message: string, variant: Variant = "success", opts?: { description?: string; duration?: number }) => {
      const id = ++idRef.current;
      const duration = opts?.duration ?? DEFAULT_DURATION;
      setToasts((l) => [...l, { id, message, variant, description: opts?.description, duration }]);
      setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  const stack = (
    <div className="pointer-events-none fixed right-5 top-5 z-[9999] flex w-[min(21rem,calc(100vw-2.5rem))] flex-col gap-2.5">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const theme = THEME[t.variant];
          const Icon = theme.Icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 70, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 70, scale: 0.92, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-lg py-2.5 pl-3.5 pr-2.5"
              style={{
                backgroundColor: "#ffffff",
                boxShadow: "0 10px 30px -12px rgba(20,20,40,0.25), 0 1px 3px rgba(20,20,40,0.08)",
                border: "1px solid rgba(20,20,40,0.08)",
              }}
            >
              {/* left accent bar */}
              <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: theme.accent }} />

              {/* icon chip */}
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
                style={{ background: theme.grad }}
              >
                <Icon size={15} />
              </span>

              {/* text */}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-tight" style={{ color: "#1a1733" }}>
                  {t.message}
                </p>
                {t.description && (
                  <p className="mt-0.5 text-xs leading-snug" style={{ color: "#6b6880" }}>
                    {t.description}
                  </p>
                )}
              </div>

              {/* dismiss */}
              <button
                onClick={() => remove(t.id)}
                aria-label="Dismiss"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-black/[0.06]"
                style={{ color: "#9a97ad" }}
              >
                <X size={14} />
              </button>

              {/* auto-dismiss progress bar */}
              <motion.span
                className="absolute bottom-0 left-0 h-[2px]"
                style={{ background: theme.accent }}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: t.duration / 1000, ease: "linear" }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      {mounted && typeof document !== "undefined" && createPortal(stack, document.body)}
    </ToastCtx.Provider>
  );
}

export function useAdminToast() {
  const ctx = useContext(ToastCtx);
  return ctx ?? { toast: () => {} };
}
