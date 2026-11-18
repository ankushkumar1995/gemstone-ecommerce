"use client";

/**
 * While live, every other panel page shows a "Back to live" banner.
 * The state comes from the panel's inbox poll (server truth), so it is right
 * in every tab and after a reload. Going offline ends the live on the server.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio } from "lucide-react";
import { AdminButton } from "@/app/admin/_components";
import { useConsultInbox } from "./consult-inbox";

export function LiveBanner() {
  const { live } = useConsultInbox();
  const pathname = usePathname();
  if (!live || pathname === "/astrologer/live") return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="status">
      <Radio size={16} className="animate-pulse" />
      <p className="flex-1">You are live: <b>{live.title}</b>. Viewers are waiting.</p>
      <Link href="/astrologer/live"><AdminButton variant="danger">Back to live</AdminButton></Link>
    </div>
  );
}
