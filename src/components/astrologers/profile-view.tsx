import Link from "next/link";
import { BadgeCheck, Clock, Languages, MessageCircle, Phone, Star, Users, Video } from "lucide-react";
import type { PublicAstrologer } from "@/modules/astrologers/astrologer.types";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { AstrologerAvatar, BADGE_TEXT, PresenceTag } from "./astrologer-card";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AstrologerProfileView({ a }: { a: PublicAstrologer }) {
  const channels = [
    { k: "chat" as const, icon: MessageCircle, label: "Chat" },
    { k: "call" as const, icon: Phone, label: "Voice call" },
    { k: "video" as const, icon: Video, label: "Video call" },
  ].filter((c) => a.rates[c.k] > 0);

  return (
    <div className="pb-16">
      <Container className="pt-6"><Breadcrumb items={[{ label: "Astrologers", href: "/astrologers" }, { label: a.displayName }]} /></Container>
      <Container className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="flex flex-wrap items-center gap-5">
            <AstrologerAvatar a={a} size={112} />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground sm:text-3xl">{a.displayName}{a.verified && <BadgeCheck className="text-emerald-600" aria-label="Verified" />}</h1>
              <p className="mt-1 text-muted">{a.expertise.join(" · ")}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1 font-semibold text-foreground"><Star size={15} className="fill-gold-400 text-gold-400" />{a.reviewCount ? `${a.rating.toFixed(1)} (${a.reviewCount} reviews)` : "New"}</span>
                <span className="inline-flex items-center gap-1 text-muted"><Clock size={15} />{a.experienceYears} years</span>
                <span className="inline-flex items-center gap-1 text-muted"><Users size={15} />{a.totalSessions} consultations</span>
                <PresenceTag a={a} />
              </div>
              {a.badges.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{a.badges.map((b) => <span key={b} className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${BADGE_TEXT[b].cls}`}>{BADGE_TEXT[b].label}</span>)}</div>}
            </div>
          </div>

          {a.shortBio && <p className="mt-6 text-lg font-medium text-foreground">{a.shortBio}</p>}
          {a.bio && <p className="mt-3 whitespace-pre-line leading-relaxed text-muted">{a.bio}</p>}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-foreground/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Languages size={16} />Languages</p>
              <p className="mt-1 text-sm text-muted">{a.languages.join(", ")}</p>
            </div>
            {a.categories.length > 0 && (
              <div className="rounded-2xl border border-foreground/10 p-4">
                <p className="text-sm font-semibold text-foreground">Helps with</p>
                <p className="mt-1 text-sm text-muted">{a.categories.join(", ")}</p>
              </div>
            )}
            {a.education && <div className="rounded-2xl border border-foreground/10 p-4"><p className="text-sm font-semibold text-foreground">Training</p><p className="mt-1 text-sm text-muted">{a.education}</p></div>}
            {a.availability.length > 0 && (
              <div className="rounded-2xl border border-foreground/10 p-4">
                <p className="text-sm font-semibold text-foreground">Usually available (IST)</p>
                <ul className="mt-1 space-y-0.5 text-sm text-muted">
                  {DAYS.map((d, i) => { const s = a.availability.filter((x) => x.day === i); return s.length ? <li key={d}><span className="inline-block w-24 text-foreground">{d}</span>{s.map((x) => `${x.start}-${x.end}`).join(", ")}</li> : null; })}
                </ul>
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-3xl border border-foreground/10 bg-white/70 p-5 shadow-sm lg:sticky lg:top-24">
          <p className="text-sm font-semibold text-foreground">Consult {a.displayName.split(" ")[0]}</p>
          <ul className="mt-3 space-y-3">
            {channels.map(({ k, icon: Icon, label }) => {
              const live = a.online && !a.busy && a.channels[k];
              return (
                <li key={k} className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full ${live ? "bg-gradient-to-br from-royal-500 to-royal-700 text-white" : "bg-foreground/5 text-muted"}`}><Icon size={17} /></span>
                  <div className="flex-1"><p className="text-sm font-medium text-foreground">{label}</p><p className="text-xs text-muted">₹{a.rates[k]}/min</p></div>
                  {live
                    ? <Link href={`/consult/${a.slug}?channel=${k}`} className="rounded-full bg-gradient-to-r from-gold-400 to-gold-500 px-4 py-2 text-sm font-semibold text-white">Start</Link>
                    : <span className="text-xs text-muted">{a.busy ? "Busy" : "Offline"}</span>}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-muted">Pay per minute from your wallet. Billing starts only after the astrologer joins. End anytime.</p>
        </aside>
      </Container>
    </div>
  );
}
