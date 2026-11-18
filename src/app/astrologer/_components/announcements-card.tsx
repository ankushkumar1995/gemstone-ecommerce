"use client";

/** Dashboard: live announcements from the Astrounkle team (admin). Hidden when there are none. */

import { useState } from "react";
import { Megaphone, Pin } from "lucide-react";
import { Card, useOnMount } from "@/app/admin/_components";
import { partnerApi } from "@/lib/astrologer-api";
import type { Announcement } from "@/modules/partner-notices/notice.types";
import { timeAgo } from "./demo";

export function AnnouncementsCard() {
  const [items, setItems] = useState<Announcement[]>([]);
  useOnMount(() => { void partnerApi.notices.announcements().then((r) => r.ok && setItems(r.data)); });
  if (!items.length) return null;
  return (
    <Card className="p-5">
      <p className="mb-3 flex items-center gap-2 font-semibold" style={{ color: "var(--a-fg)" }}><Megaphone size={16} style={{ color: "var(--a-gold)" }} /> From the Astrounkle team</p>
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: a.pinned ? "var(--a-gold)" : "var(--a-border)", background: a.pinned ? "var(--a-gold-soft)" : "transparent" }}>
            <p className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--a-fg)" }}>{a.pinned && <Pin size={13} style={{ color: "var(--a-gold)" }} />}{a.title}</p>
            <p className="mt-0.5 whitespace-pre-line" style={{ color: "var(--a-muted)" }}>{a.body}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--a-faint)" }}>{timeAgo(a.createdAt)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
