"use client";

/**
 * Partner session context: the signed-in astrologer's account, presence
 * controls and a heartbeat loop.
 *
 * Heartbeat: every 20s while online and the tab is visible; immediately when
 * the tab becomes visible again. If the tab sleeps or closes, the server marks
 * the partner offline after `presenceStaleSec` (default 60s), so customers
 * never see a "ghost" online astrologer.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { SelfAstrologer } from "@/modules/astrologers/astrologer.types";
import { partnerApi } from "@/lib/astrologer-api";
import { useOnMount } from "@/app/admin/_components";

const HEARTBEAT_MS = 20_000;

interface Ctx {
  me: SelfAstrologer | null;
  loading: boolean;
  reload: () => Promise<void>;
  setMe: (a: SelfAstrologer) => void;
  goOnline: (channels?: Partial<Record<"chat" | "call" | "video", boolean>>) => Promise<string | null>;
  goOffline: () => Promise<void>;
  busy: boolean;
}

const PartnerCtx = createContext<Ctx | null>(null);

export function PartnerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<SelfAstrologer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const online = me?.presence.online ?? false;
  const onlineRef = useRef(online);
  useEffect(() => { onlineRef.current = online; }, [online]);

  const reload = useCallback(async () => {
    const res = await partnerApi.me();
    if (res.ok) setMe(res.data);
    setLoading(false);
  }, []);

  useOnMount(() => { void reload(); });

  // Invited partners must set their own password first.
  useEffect(() => {
    if (me?.mustChangePassword && pathname !== "/astrologer/security") router.replace("/astrologer/security?first=1");
  }, [me?.mustChangePassword, pathname, router]);

  const beat = useCallback(async () => {
    if (!onlineRef.current || document.visibilityState !== "visible") return;
    const res = await partnerApi.presence("heartbeat");
    if (res.ok) setMe(res.data);
  }, []);

  useEffect(() => {
    if (!online) return;
    const t = setInterval(beat, HEARTBEAT_MS);
    const onVis = () => { if (document.visibilityState === "visible") void beat(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [online, beat]);

  const goOnline = useCallback(async (channels?: Partial<Record<"chat" | "call" | "video", boolean>>) => {
    setBusy(true);
    const res = await partnerApi.presence("online", channels);
    setBusy(false);
    if (res.ok) { setMe(res.data); return null; }
    return res.message;
  }, []);

  const goOffline = useCallback(async () => {
    setBusy(true);
    const res = await partnerApi.presence("offline");
    setBusy(false);
    if (res.ok) setMe(res.data);
  }, []);

  return <PartnerCtx.Provider value={{ me, loading, reload, setMe, goOnline, goOffline, busy }}>{children}</PartnerCtx.Provider>;
}

export function usePartner(): Ctx {
  const c = useContext(PartnerCtx);
  if (!c) throw new Error("usePartner must be used inside PartnerProvider");
  return c;
}
