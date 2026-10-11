"use client";

/**
 * Admin toast system — scoped to the admin area (separate from the storefront
 * toasts). Provider mounts a stacked, animated list; `useAdminToast().toast()`
 * fires feedback like "Saved", "Deleted" from any action.
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "success" | "info" | "error";
interface Toast {
  id: number;
  message: string;
  variant: Variant;
}

const ToastCtx = createContext<{ toast: (m: string, v?: Variant) => void } | null>(null);

const icons: Record<Variant, React.ElementType> = {
  success: CheckCircle2,
  info: Info,
  error: AlertTriangle,
};
const accent: Record<Variant, string> = {
  success: "text-emerald-600",
  info: "text-sky-600",
  error: "text-rose-600",
};

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback(
    (id: number) => setToasts((l) => l.filter((t) => t.id !== id)),
    []
  );
  const toast = useCallback(
    (message: string, variant: Variant = "success") => {
      const id = ++idRef.current;
      setToasts((l) => [...l, { id, message, variant }]);
      setTimeout(() => remove(id), 2800);
    },
    [remove]
  );

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = icons[t.variant];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xl"
                style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    accent[t.variant]
                  )}
                  style={{ background: "var(--a-surface-2)" }}
                >
                  <Icon size={17} />
                </span>
                <p className="flex-1 text-sm font-medium" style={{ color: "var(--a-fg)" }}>
                  {t.message}
                </p>
                <button
                  onClick={() => remove(t.id)}
                  aria-label="Dismiss"
                  style={{ color: "var(--a-muted)" }}
                >
                  <X size={15} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useAdminToast() {
  const ctx = useContext(ToastCtx);
  return ctx ?? { toast: () => {} };
}
