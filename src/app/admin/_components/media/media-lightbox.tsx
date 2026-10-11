"use client";

/**
 * MediaLightbox — full-screen image preview with prev/next navigation and
 * keyboard support (←/→/Esc). Driven by the active item id within a list.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { MediaItem } from "@/lib/media-store";

export function MediaLightbox({
  items,
  activeId,
  onClose,
  onNavigate,
}: {
  items: MediaItem[];
  activeId: string | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const index = items.findIndex((m) => m.id === activeId);
  const item = index >= 0 ? items[index] : null;

  const go = (dir: 1 | -1) => {
    if (index < 0) return;
    const next = (index + dir + items.length) % items.length;
    onNavigate(items[next].id);
  };

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, index]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md"
          onClick={onClose}
        >
          {/* close */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X size={22} />
          </button>

          {/* counter */}
          <span className="absolute left-5 top-6 text-sm text-white/70">
            {index + 1} / {items.length}
          </span>

          {/* prev */}
          {items.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="Previous"
              className="absolute left-5 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {/* image */}
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] max-w-[85vw] flex-col items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.alt} className="max-h-[78vh] max-w-full rounded-lg object-contain shadow-2xl" />
            <div className="mt-3 text-center">
              <p className="text-sm font-medium text-white">{item.name}</p>
              {item.width && item.height && (
                <p className="text-xs text-white/60">
                  {item.width} × {item.height}
                </p>
              )}
            </div>
          </motion.div>

          {/* next */}
          {items.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="Next"
              className="absolute right-5 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
