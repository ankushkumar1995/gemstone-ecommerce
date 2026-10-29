"use client";

/**
 * PopupManager — storefront orchestrator for admin-managed popups.
 *
 * Receives the live popups (fetched server-side in the (site) layout) and:
 *  1. Filters to those eligible for THIS visitor on THIS page (device, page,
 *     audience, auth, frequency cap / cooldown / "don't show again").
 *  2. Picks the single highest-priority eligible popup.
 *  3. Arms its trigger (delay / scroll / exit-intent / load).
 *  4. When it fires, renders it, records an impression, and enforces the
 *     frequency cap. Close/CTA/submit record their own analytics events.
 *
 * Only ONE popup shows per page view (the winner). If it's dismissed, we don't
 * immediately show the next — keeps the experience non-spammy.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import type { PublicPopup } from "@/modules/popups";
import { api } from "@/lib/api-client";
import {
  frequencyAllows,
  markClosedForever,
  markDismissed,
  markSeen,
  markShown,
  matchesAudience,
  matchesAuth,
  matchesDevice,
  matchesPage,
} from "@/lib/popup-visitor";
import { PopupCard } from "./popup-card";

export function PopupManager({ popups }: { popups: PublicPopup[] }) {
  const pathname = usePathname();
  const [active, setActive] = useState<PublicPopup | null>(null);
  const firedRef = useRef(false);

  // If any popup targets by auth, resolve the login state once. When no popup
  // needs it, start resolved as "guest" so candidate selection doesn't wait.
  const needsAuth = useMemo(
    () => popups.some((p) => p.targeting.auth !== "all"),
    [popups],
  );
  const [loggedIn, setLoggedIn] = useState<boolean | null>(() => (needsAuth ? null : false));

  useEffect(() => {
    if (!needsAuth) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/account/me");
        if (alive) setLoggedIn(res.ok);
      } catch {
        if (alive) setLoggedIn(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [needsAuth]);

  // Pick the winning popup for this page once we know enough.
  const candidate = useMemo(() => {
    if (needsAuth && loggedIn === null) return null; // wait for auth resolution
    const path = pathname || "/";
    const eligible = popups
      .filter((p) => matchesPage(p, path))
      .filter((p) => matchesDevice(p))
      .filter((p) => matchesAudience(p))
      .filter((p) => matchesAuth(p, loggedIn))
      .filter((p) => frequencyAllows(p))
      .sort((a, b) => b.priority - a.priority);
    return eligible[0] ?? null;
  }, [popups, pathname, loggedIn, needsAuth]);

  // Mark this browser as "seen" so the NEXT visit is "returning".
  useEffect(() => {
    markSeen();
  }, []);

  // Arm the trigger for the candidate. Re-arms when the candidate changes
  // (e.g. navigation to a page where a different popup wins).
  useEffect(() => {
    if (!candidate || active) return;
    firedRef.current = false;

    const fire = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      setActive(candidate);
      markShown(candidate);
      api.popups.track(candidate.id, "impression");
      cleanup();
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanups: Array<() => void> = [];
    function cleanup() {
      if (timer) clearTimeout(timer);
      cleanups.forEach((fn) => fn());
    }

    const t = candidate.trigger;
    if (t.type === "load") {
      fire();
    } else if (t.type === "delay") {
      timer = setTimeout(fire, Math.max(0, t.delaySeconds) * 1000);
    } else if (t.type === "scroll") {
      const onScroll = () => {
        const doc = document.documentElement;
        const scrolled = doc.scrollTop / Math.max(1, doc.scrollHeight - doc.clientHeight);
        if (scrolled * 100 >= t.scrollPercent) fire();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
      onScroll();
    } else if (t.type === "exit-intent") {
      const onLeave = (e: MouseEvent) => {
        if (e.clientY <= 0) fire();
      };
      document.addEventListener("mouseout", onLeave);
      cleanups.push(() => document.removeEventListener("mouseout", onLeave));
      // Exit-intent is desktop-only; on mobile fall back to a 15s delay.
      timer = setTimeout(fire, 15000);
    }

    return cleanup;
  }, [candidate, active]);

  const handleClose = (opts?: { dontShowAgain?: boolean }) => {
    if (!active) return;
    api.popups.track(active.id, "dismiss");
    markDismissed(active.id);
    if (opts?.dontShowAgain) markClosedForever(active.id);
    setActive(null);
  };

  const handleCta = (href: string) => {
    if (!active) return;
    api.popups.track(active.id, "click");
    // Let analytics flush, then navigate.
    if (href) {
      if (/^https?:\/\//i.test(href)) window.open(href, "_blank");
      else window.location.href = href;
    }
    setActive(null);
  };

  const handleSubmit = async (data: {
    email: string;
    name?: string;
    phone?: string;
    message?: string;
  }): Promise<boolean> => {
    if (!active) return false;
    const res = await api.popups.submit({ popupId: active.id, ...data });
    return res.ok;
  };

  // Esc-to-close.
  useEffect(() => {
    if (!active || !active.design.closeOnEsc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <PopupCard
          key={active.id}
          popup={active}
          onClose={handleClose}
          onCtaClick={handleCta}
          onSubmit={handleSubmit}
        />
      )}
    </AnimatePresence>
  );
}
