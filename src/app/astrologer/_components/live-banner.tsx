"use client";

/**
 * While live, every other panel page shows a "Back to live" banner.
 * Going offline ends a live (viewers and callers are told, no one is charged).
 */

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio } from "lucide-react";
import { AdminButton, useAdminToast } from "@/app/admin/_components";
import { usePartner } from "./partner-context";
import { liveStore, useStore } from "./demo-store";

export function LiveBanner() {
  const live = useStore(liveStore);
  const pathname = usePathname();
  const { me } = usePartner();
  const { toast } = useAdminToast();
  const loaded = me !== null;
  const online = me?.presence.online ?? false;

  useEffect(() => {
    if (loaded && !online && liveStore.get()) {
      liveStore.set(null);
      toast("You went offline, so your live ended. Viewers and callers were told.", "info");
    }
  }, [loaded, online, toast]);

  if (!live || pathname === "/astrologer/live") return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="status">
      <Radio size={16} className="animate-pulse" />
      <p className="flex-1">You are live: <b>{live.title}</b>. Viewers are waiting.</p>
      <Link href="/astrologer/live"><AdminButton variant="danger">Back to live</AdminButton></Link>
    </div>
  );
}
