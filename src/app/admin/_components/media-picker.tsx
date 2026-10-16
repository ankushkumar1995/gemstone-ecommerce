"use client";

/**
 * MediaPickerModal — opens the full WordPress-style MediaLibrary in picker
 * mode so a product form can select one or more images from the library.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { MediaItem } from "@/lib/media-store";
import { AdminButton } from "./ui";
import { MediaLibrary } from "./media/media-library";

export function MediaPickerModal({
  open,
  onClose,
  initialSelected = [],
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  initialSelected?: string[];
  onConfirm: (urls: string[]) => void;
}) {
  const [sel, setSel] = useState<string[]>(initialSelected);

  // Reset selection to the current gallery each time the modal opens, so a
  // previous session's selection doesn't leak in.
  useEffect(() => {
    if (open) setSel(initialSelected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (item: MediaItem) =>
    setSel((prev) =>
      prev.includes(item.url) ? prev.filter((u) => u !== item.url) : [...prev, item.url]
    );

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
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border shadow-2xl"
              style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
            >
              <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--a-border)" }}>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>
                    Media Library
                  </h3>
                  <p className="text-sm" style={{ color: "var(--a-muted)" }}>
                    {sel.length} selected · click to toggle · order shown as number
                  </p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/[0.04]" style={{ color: "var(--a-muted)" }}>
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <MediaLibrary picker selected={sel} onToggleSelect={toggle} />
              </div>
              <div className="flex justify-end gap-3 border-t p-4" style={{ borderColor: "var(--a-border)" }}>
                <AdminButton type="button" variant="outline" onClick={onClose}>
                  Cancel
                </AdminButton>
                <AdminButton
                  type="button"
                  onClick={() => {
                    onConfirm(sel);
                    onClose();
                  }}
                >
                  Use {sel.length} image{sel.length !== 1 ? "s" : ""}
                </AdminButton>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
