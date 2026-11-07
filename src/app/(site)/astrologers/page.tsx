import type { Metadata } from "next";
import { Suspense } from "react";
import { astrologerService, type PublicListFilter } from "@/modules/astrologers";
import { DirectoryView } from "@/components/astrologers/directory-view";

export const metadata: Metadata = {
  title: "Talk to Astrologers Online · Chat & Call Verified Astrologers",
  description: "Chat or call verified Vedic, KP, Tarot and Numerology astrologers online. See ratings, languages, experience and per-minute rates.",
  alternates: { canonical: "/astrologers" },
};

// Presence and ratings change constantly: always render fresh.
export const dynamic = "force-dynamic";

const SORTS = ["recommended", "rating", "experience", "price_low", "price_high", "sessions"];

export default async function AstrologersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v)?.slice(0, 60) || undefined; };
  const page = Math.max(1, Math.floor(Number(one("page")) || 1));
  const channel = one("channel");
  const filter: PublicListFilter = {
    q: one("q"), expertise: one("expertise"), category: one("category"), language: one("language"),
    online: one("online") === "1",
    channel: channel === "chat" || channel === "call" || channel === "video" ? channel : undefined,
    sort: SORTS.includes(one("sort") ?? "") ? (one("sort") as PublicListFilter["sort"]) : undefined,
    page, pageSize: 18,
  };
  const res = await astrologerService.listPublic(filter);
  const data = res.ok ? res.value : { items: [], total: 0, page: 1, pageSize: 18, onlineCount: 0 };
  return (
    <Suspense>
      <DirectoryView items={data.items} total={data.total} page={data.page} pageSize={data.pageSize} onlineCount={data.onlineCount} />
    </Suspense>
  );
}
