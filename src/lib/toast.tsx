"use client";

/**
 * Lightweight toast notification system.
 *
 * A context exposes `toast(...)`; a provider renders a stacked, animated list
 * in the corner. Used across the app for feedback like "Added to cart" or
 * "Wishlist updated". No external dependency.
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
import { CheckCircle2, Info, AlertTriangle, Heart, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "info" | "error" | "wishlist";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  info: Info,
  error: AlertTriangle,
  wishlist: Heart,
};

const accent: Record<ToastVariant, string> = {
  success: "text-emerald-600",
  info: "text-royal-600",
  error: "text-rose-mystic",
  wishlist: "text-rose-mystic",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(0);

  // only portal after mount (SSR-safe)
  useEffect(() => setMounted(true), []);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, variant }]);
      setTimeout(() => remove(id), 2800);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-24 right-5 z-[60] flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2.5">
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
                    className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-foreground/10 bg-cosmos/95 px-4 py-3 shadow-[0_20px_50px_-20px_rgba(36,26,59,0.5)] backdrop-blur-xl"
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/5",
                        accent[t.variant]
                      )}
                    >
                      <Icon
                        size={18}
                        className={cn(t.variant === "wishlist" && "fill-current")}
                      />
                    </span>
                    <p className="flex-1 text-sm font-medium text-foreground">
                      {t.message}
                    </p>
                    <button
                      onClick={() => remove(t.id)}
                      aria-label="Dismiss"
                      className="shrink-0 text-muted transition-colors hover:text-foreground"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // graceful no-op if used outside provider
    return { toast: () => {} };
  }
  return ctx;
}
