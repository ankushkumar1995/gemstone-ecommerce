import Link from "next/link";
import { BadgeCheck, MessageCircle, Phone, Star, Video } from "lucide-react";
import type { AstroBadge, PublicAstrologer } from "@/modules/astrologers/astrologer.types";

export const BADGE_TEXT: Record<AstroBadge, { label: string; cls: string }> = {
  vip: { label: "VIP", cls: "bg-gradient-to-r from-gold-300 to-gold-500 text-[#3a1b00]" },
  trending: { label: "Trending", cls: "bg-gradient-to-r from-orange-400 to-rose-500 text-white" },
  topRated: { label: "Top Rated", cls: "bg-gradient-to-r from-royal-500 to-royal-700 text-gold-200" },
  rising: { label: "Rising Star", cls: "bg-gradient-to-r from-pink-400 to-fuchsia-600 text-white" },
  mostBooked: { label: "Most Booked", cls: "bg-gradient-to-r from-emerald-500 to-emerald-700 text-white" },
};

export function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/** Status dot + label: Online / Busy / Offline. */
export function PresenceTag({ a }: { a: Pick<PublicAstrologer, "online" | "busy"> }) {
  const label = a.busy ? "Busy" : a.online ? "Online" : "Offline";
  const dot = a.busy ? "bg-amber-500" : a.online ? "bg-emerald-500" : "bg-slate-400";
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted"><span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />{label}</span>;
}

export function AstrologerAvatar({ a, size = 72 }: { a: Pick<PublicAstrologer, "photo" | "displayName" | "online" | "busy">; size?: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {a.photo ? (
        // Plain <img>: photos come from S3, which is not in next/image remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.photo} alt={a.displayName} width={size} height={size} loading="lazy" className="h-full w-full rounded-full object-cover ring-2 ring-gold-300/60" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-royal-500 to-royal-700 font-semibold text-gold-200 ring-2 ring-gold-300/60" style={{ fontSize: size / 3 }}>{initials(a.displayName)}</span>
      )}
      {(a.online || a.busy) && <span className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${a.busy ? "bg-amber-500" : "bg-emerald-500"}`} aria-hidden />}
    </span>
  );
}

export function AstrologerCard({ a }: { a: PublicAstrologer }) {
  const channels = [
    { k: "chat" as const, icon: MessageCircle, label: "Chat" },
    { k: "call" as const, icon: Phone, label: "Call" },
    { k: "video" as const, icon: Video, label: "Video" },
  ].filter((c) => a.rates[c.k] > 0);
  return (
    <Link href={`/astrologers/${a.slug}`} className="group flex flex-col rounded-3xl border border-foreground/10 bg-white/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gold-400/50 hover:shadow-md">
      <div className="flex gap-4">
        <AstrologerAvatar a={a} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate font-semibold text-foreground">{a.displayName}{a.verified && <BadgeCheck size={16} className="shrink-0 text-emerald-600" aria-label="Verified" />}</p>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted">{a.expertise.slice(0, 3).join(" · ")}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted">{a.languages.slice(0, 3).join(", ")} · {a.experienceYears} yrs</p>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground"><Star size={14} className="fill-gold-400 text-gold-400" />{a.reviewCount ? a.rating.toFixed(1) : "New"}{a.reviewCount ? <span className="font-normal text-muted">({a.reviewCount})</span> : null}</span>
            <PresenceTag a={a} />
          </div>
        </div>
      </div>
      {a.badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.badges.slice(0, 2).map((b) => <span key={b} className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BADGE_TEXT[b].cls}`}>{BADGE_TEXT[b].label}</span>)}
        </div>
      )}
      {a.shortBio && <p className="mt-3 line-clamp-2 text-sm text-muted">{a.shortBio}</p>}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <p className="text-sm text-foreground"><span className="text-lg font-semibold">₹{a.rates.chat}</span><span className="text-muted">/min</span></p>
        <div className="flex gap-1.5">
          {channels.map(({ k, icon: Icon, label }) => (
            <span key={k} title={`${label} ₹${a.rates[k]}/min`} className={`flex h-9 w-9 items-center justify-center rounded-full ${a.online && a.channels[k] ? "bg-gradient-to-br from-royal-500 to-royal-700 text-white" : "bg-foreground/5 text-muted"}`}>
              <Icon size={15} /><span className="sr-only">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
