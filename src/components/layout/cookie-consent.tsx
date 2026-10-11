"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "nakshatra-cookie-consent";

/**
 * Cookie consent banner. Appears once (bottom-left) until the user accepts or
 * declines; the choice is remembered in localStorage. Positioned to avoid the
 * WhatsApp FAB (bottom-right) and toasts.
 */
export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // small delay so it doesn't fight the page's entrance animations
        const t = setTimeout(() => setShow(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const decide = (choice: "accepted" | "declined") => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="fixed bottom-5 left-5 z-[58] w-[min(23rem,calc(100vw-2.5rem))] overflow-hidden rounded-3xl border border-foreground/10 bg-cosmos/95 shadow-[0_30px_80px_-24px_rgba(36,26,59,0.5)] backdrop-blur-xl"
        >
          <div className="h-1 w-full bg-gradient-to-r from-gold-400 via-gold-500 to-royal-500" />
          <div className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400/20 to-royal-400/15 text-gold-600">
                <Cookie size={20} />
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">
                  We value your privacy
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  We use cookies to improve your experience, personalise content
                  and analyse traffic. Read our{" "}
                  <Link
                    href="/policies"
                    className="text-gold-600 underline-offset-2 hover:underline"
                  >
                    privacy policy
                  </Link>
                  .
                </p>
              </div>
              <button
                onClick={() => decide("declined")}
                aria-label="Dismiss"
                className="shrink-0 text-muted transition-colors hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex gap-2.5">
              <Button
                variant="gold"
                size="sm"
                className="flex-1"
                onClick={() => decide("accepted")}
              >
                Accept All
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => decide("declined")}
              >
                Decline
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
