"use client";

/**
 * Partner app install + alerts.
 *
 * Real today:  service worker registration (scope /astrologer/), install
 *              prompt (Android / desktop Chrome, Edge), iOS "Add to Home
 *              Screen" guidance, notification permission and a local test
 *              alert shown through the service worker.
 * Later:       server push (Web Push with VAPID keys) so requests ring even
 *              when the panel is closed. The worker already handles `push`.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Smartphone, X } from "lucide-react";
import { AdminButton, useOnMount } from "@/app/admin/_components";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/* Install prompt is captured once per page load and shared. */
let deferred: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const emit = () => installListeners.forEach((l) => l());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallPromptEvent; emit(); });
  window.addEventListener("appinstalled", () => { deferred = null; emit(); });
}
const subscribeInstall = (l: () => void) => { installListeners.add(l); return () => { installListeners.delete(l); }; };

export type PushState = "unsupported" | "default" | "granted" | "denied";

export function usePwa() {
  const canPrompt = useSyncExternalStore(subscribeInstall, () => deferred !== null, () => false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [push, setPush] = useState<PushState>("unsupported");
  const [swReady, setSwReady] = useState(false);

  useOnMount(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setPush(!("Notification" in window) || !("serviceWorker" in navigator) ? "unsupported" : (Notification.permission as PushState));
  });

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/astrologer-sw.js", { scope: "/astrologer/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => { if (!cancelled) setSwReady(true); })
      .catch(() => { if (!cancelled) setSwReady(false); });
    return () => { cancelled = true; };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null;
    emit();
    if (choice.outcome === "accepted") setInstalled(true);
    return choice.outcome === "accepted";
  }, []);

  const enablePush = useCallback(async () => {
    if (!("Notification" in window)) return "unsupported" as PushState;
    const p = (await Notification.requestPermission()) as PushState;
    setPush(p);
    return p;
  }, []);

  const testAlert = useCallback(async () => {
    if (!("serviceWorker" in navigator) || Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.getRegistration("/astrologer/");
    if (!reg) return false;
    await reg.showNotification("New chat request (test)", {
      body: "Riya S.: Meri shaadi kab hogi? Tap to open Live requests.",
      tag: "test-request",
      icon: "/images/image1.png",
      requireInteraction: true,
      data: { url: "/astrologer/requests" },
    });
    return true;
  }, []);

  return { canPrompt, installed, ios, push, swReady, install, enablePush, testAlert };
}

const NUDGE_KEY = "astro_install_nudge_dismissed";

/** One-time, dismissible banner suggesting install + alerts. */
export function InstallNudge() {
  const { canPrompt, installed, install } = usePwa();
  const [dismissed, setDismissed] = useState(true);
  useOnMount(() => setDismissed(localStorage.getItem(NUDGE_KEY) === "1"));
  if (dismissed || installed || !canPrompt) return null;
  const close = () => { localStorage.setItem(NUDGE_KEY, "1"); setDismissed(true); };
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3" style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }} role="region" aria-label="Install the partner app">
      <Smartphone size={18} style={{ color: "var(--a-gold)" }} />
      <p className="flex-1 text-sm" style={{ color: "var(--a-fg)" }}>Install the Partner app on your phone so requests open in one tap.</p>
      <AdminButton onClick={async () => { if (await install()) close(); }}>Install</AdminButton>
      <button type="button" onClick={close} aria-label="Dismiss" className="rounded-md p-1.5" style={{ color: "var(--a-muted)" }}><X size={16} /></button>
    </div>
  );
}
