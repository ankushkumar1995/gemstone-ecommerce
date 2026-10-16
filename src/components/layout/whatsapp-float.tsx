"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";

/**
 * Premium WhatsApp floating action button.
 *
 * - Appears after the user scrolls a little (keeps the hero clean).
 * - Pulsing ring + subtle breathing to draw the eye without being noisy.
 * - Click opens a small chat card with quick-start messages; each sends the
 *   user to WhatsApp with a prefilled text.
 */

const quickMessages = [
  "I need help choosing a gemstone 💎",
  "Is this stone certified & natural?",
  "I'd like a free astrology consultation 🔮",
  "Help me track my order",
];

export function WhatsAppFloat() {
  const store = useStoreSettings();
  const phone = phoneDigits(store.whatsappNumber);
  const AGENT_NAME = `${store.storeName} Support`;
  const waLink = (text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

  // show the button from the very start (not only after scrolling)
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  // mount after hydration so the entrance animation plays cleanly (SSR-safe)
  useEffect(() => setVisible(true), []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="fixed bottom-5 right-5 z-[55] flex flex-col items-end gap-3"
        >
          {/* Chat card */}
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.95 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="w-[min(20rem,calc(100vw-2.5rem))] overflow-hidden rounded-3xl border border-foreground/10 bg-cosmos shadow-[0_30px_80px_-24px_rgba(36,26,59,0.5)]"
              >
                {/* header */}
                <div className="relative flex items-center gap-3 bg-[#075E54] px-4 py-4 text-white">
                  <div className="relative">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
                      <WhatsAppGlyph className="h-6 w-6" />
                    </span>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#075E54] bg-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold leading-tight">
                      {AGENT_NAME}
                    </p>
                    <p className="text-xs text-white/70">Typically replies instantly</p>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close chat"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* body with chat-paper feel */}
                <div className="bg-[#ECE5DD] px-4 py-4">
                  <div className="rounded-xl rounded-tl-sm bg-white px-3.5 py-2.5 shadow-sm">
                    <p className="text-sm text-gray-700">
                      Namaste! 🙏 How can we help you find the right gemstone
                      today?
                    </p>
                  </div>

                  <p className="mt-3 mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-500">
                    Quick start
                  </p>
                  <div className="space-y-2">
                    {quickMessages.map((m) => (
                      <a
                        key={m}
                        href={waLink(m)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-sm transition-colors hover:bg-emerald-50"
                      >
                        <span>{m}</span>
                        <Send size={14} className="shrink-0 text-[#25D366]" />
                      </a>
                    ))}
                  </div>

                  <a
                    href={waLink("Hi! I have a question about Astrounkle gemstones.")}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#20bd5a]"
                  >
                    <WhatsAppGlyph className="h-4 w-4" />
                    Start Chat on WhatsApp
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* FAB */}
          <div className="relative">
            {/* pulsing rings (only when closed) */}
            {!open && (
              <>
                <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/40" />
                <span className="absolute inset-0 animate-pulse rounded-full bg-[#25D366]/20" />
              </>
            )}
            <motion.button
              onClick={() => setOpen((v) => !v)}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              aria-label={open ? "Close WhatsApp chat" : "Chat on WhatsApp"}
              className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white shadow-[0_12px_30px_-8px_rgba(37,211,102,0.6)]"
            >
              <AnimatePresence mode="wait" initial={false}>
                {open ? (
                  <motion.span
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X size={26} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="chat"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <WhatsAppGlyph className="h-7 w-7" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* unread-style nudge dot (closed only) */}
            {!open && (
              <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-mystic text-[10px] font-bold text-white shadow">
                1
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Official-style WhatsApp glyph (lucide has no brand icon in this version). */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.515 5.26l-.999 3.648 3.973-1.042zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.767.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}
