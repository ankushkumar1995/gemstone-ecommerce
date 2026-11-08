"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScrollText,
  Gem,
  HeartHandshake,
  TrendingUp,
  Home,
  CalendarClock,
  Hash,
  PhoneCall,
  Star,
  Check,
  Clock,
  BadgeCheck,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Link2,
  MessageCircle,
  Moon,
  Sun,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { AstroService } from "@/types";
import { useCurrency } from "@/lib/currency";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";
import { useToast } from "@/lib/toast";
import { api } from "@/lib/api-client";
import { Container } from "@/components/ui/container";
import { Button, ButtonLink } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ServiceBookingForm } from "@/components/services/service-booking-form";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  ScrollText,
  Gem,
  HeartHandshake,
  TrendingUp,
  Home,
  CalendarClock,
  Hash,
  PhoneCall,
  Star,
  Moon,
  Sun,
  Sparkles,
};

export type DetailCategory = { id: string; name: string; slug: string; icon: string };
type Group = { key: string; name: string; icon: string; items: AstroService[] };

export function ServiceDetailView({
  service,
  services,
  categories = [],
}: {
  service: AstroService;
  services: AstroService[];
  categories?: DetailCategory[];
}) {
  const { format } = useCurrency();
  const store = useStoreSettings();
  const Icon = iconMap[service.icon] ?? Sparkles;

  // Group the sidebar by category. Services without a visible category go
  // under "Other services" so nothing is ever hidden.
  const groups = useMemo<Group[]>(() => {
    const known = new Set(categories.map((c) => c.id));
    const out: Group[] = categories
      .map((c) => ({ key: c.id, name: c.name, icon: c.icon, items: services.filter((s) => s.categoryId === c.id) }))
      .filter((g) => g.items.length > 0);
    const rest = services.filter((s) => !s.categoryId || !known.has(s.categoryId));
    if (rest.length > 0) out.push({ key: "__other", name: out.length ? "Other services" : "All Services", icon: "Sparkles", items: rest });
    return out;
  }, [categories, services]);
  const myGroup = groups.find((g) => g.items.some((s) => s.slug === service.slug))?.key;
  const myCategory = categories.find((c) => c.id === service.categoryId);

  // The current service's group starts open; the rest are one click away.
  const [open, setOpen] = useState<Set<string>>(() => new Set(myGroup ? [myGroup] : []));
  const toggle = (k: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  // "Book Now" links land on #book. The form can shift on load (auth check),
  // so scroll once more after the layout settles.
  useEffect(() => {
    if (window.location.hash !== "#book") return;
    const go = () => document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
    const a = window.setTimeout(go, 150);
    const b = window.setTimeout(go, 700);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, []);

  return (
    <Container className="py-5 sm:py-6">
      <Breadcrumb
        items={[
          { label: "Services", href: "/services" },
          ...(myCategory ? [{ label: myCategory.name, href: `/services?category=${myCategory.slug}` }] : []),
          { label: service.title },
        ]}
        className="mb-4"
      />

      <div className="grid gap-5 lg:grid-cols-[17rem_1fr] lg:gap-6">
        {/* ---- Left: services list ---- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-foreground/10 bg-nebula p-2">
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">
              Services
            </p>
            <nav aria-label="Services by category" className="space-y-0.5">
              {groups.map((g) => {
                const GIcon = iconMap[g.icon] ?? Sparkles;
                const isOpen = open.has(g.key);
                const hasActive = g.key === myGroup;
                return (
                  <div key={g.key}>
                    <button
                      type="button"
                      onClick={() => toggle(g.key)}
                      aria-expanded={isOpen}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60",
                        hasActive ? "text-gold-600" : "text-foreground hover:bg-foreground/[0.04]"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          hasActive ? "bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-sm" : "bg-foreground/5 text-gold-600"
                        )}
                      >
                        <GIcon size={14} />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{g.name}</span>
                      <span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted">{g.items.length}</span>
                      <ChevronDown size={14} className={cn("shrink-0 text-muted transition-transform duration-200", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <ul className="ml-[1.35rem] mt-0.5 space-y-px border-l border-foreground/10 pl-2">
                        {g.items.map((s) => {
                          const active = s.slug === service.slug;
                          return (
                            <li key={s.slug}>
                              <Link
                                href={`/services/${s.slug}`}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                  "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition-colors",
                                  active ? "bg-gold-400/12 font-semibold text-gold-600" : "text-foreground/85 hover:bg-foreground/[0.04] hover:text-foreground"
                                )}
                              >
                                <span className="min-w-0">{s.title}</span>
                                {active && <ChevronRight size={13} className="shrink-0" />}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="mt-2 rounded-xl bg-gradient-to-br from-royal-500 to-royal-700 p-3.5 text-white">
              <p className="text-sm font-semibold">Need help choosing?</p>
              <p className="mt-1 text-xs text-white/75">
                Book a free discovery call.
              </p>
              <a
                href={`https://wa.me/${phoneDigits(store.whatsappNumber)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-200 hover:text-white"
              >
                Chat now <ChevronRight size={14} />
              </a>
            </div>
          </div>
        </aside>

        {/* ---- Right: detail + lead form ---- */}
        <div>
          {/* header: image on the left, details + CTA on the right */}
          <div className="overflow-hidden rounded-3xl border border-foreground/10 bg-nebula p-4 sm:p-5">
            <div className="grid gap-5 md:grid-cols-2 md:items-center">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 ring-1 ring-foreground/10">
                {service.image ? (
                  <Image
                    src={service.image}
                    alt={service.title}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 40vw"
                    className="object-cover object-[center_30%]"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-gold-600">
                    <Icon size={56} strokeWidth={1.4} />
                  </span>
                )}
                {service.popular && (
                  <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gold-600 shadow-sm backdrop-blur">
                    <Star size={11} className="fill-gold-500 text-gold-500" />
                    Popular
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-col">
                {myCategory && (
                  <Link
                    href={`/services?category=${myCategory.slug}`}
                    className="w-fit text-[11px] font-semibold uppercase tracking-wider text-royal-500 hover:text-gold-600"
                  >
                    {myCategory.name}
                  </Link>
                )}
                <h1 className="mt-1 text-2xl font-semibold leading-tight text-foreground sm:text-[1.75rem]">
                  {service.title}
                </h1>
                {service.tagline && (
                  <p className="mt-1 text-sm font-medium text-gold-600">{service.tagline}</p>
                )}

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-foreground">
                    {service.priceFrom === 0 ? "Free" : format(service.priceFrom)}
                  </span>
                  {service.priceFrom > 0 && <span className="text-xs text-muted">onwards</span>}
                </div>

                <ul className="mt-3 space-y-1.5 text-sm text-foreground">
                  <li className="flex items-center gap-2">
                    <Clock size={15} className="text-gold-500" />
                    <span className="text-muted">Duration:</span> {service.duration}
                  </li>
                  {service.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span className="line-clamp-1">{f}</span>
                    </li>
                  ))}
                </ul>
                {service.features.length > 3 && (
                  <a
                    href="#included"
                    className="mt-1.5 inline-flex w-fit items-center gap-1 pl-6 text-[13px] font-semibold text-gold-600 hover:text-gold-500"
                  >
                    Read more ({service.features.length - 3} more)
                    <ChevronDown size={14} />
                  </a>
                )}

                <ShareRow title={service.title} slug={service.slug} />

                {/* CTA: scrolls to the booking form below */}
                <ButtonLink href="#book" variant="gold" size="md" className="mt-4 self-start px-6">
                  {service.priceFrom > 0 ? "Book Now" : "Request Callback"}
                  <ArrowRight size={15} />
                </ButtonLink>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <BadgeCheck size={14} className="text-gold-500" /> Verified astrologers
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-gold-500" /> 100% private
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Star size={14} className="text-gold-500" /> 4.9 rating
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* about */}
          {service.description.replace(/<[^>]+>/g, "").trim() && (
            <div className="mt-4 rounded-3xl border border-foreground/10 bg-nebula p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-foreground">About this service</h2>
              <div
                className="prose-service mt-2 text-[15px] leading-relaxed text-muted [&_a]:text-gold-600 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-gold-400/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_img]:my-4 [&_img]:rounded-xl [&_li]:ml-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: service.description }}
              />
            </div>
          )}
          {/* what's included */}
          {service.features.length > 0 && (
          <div id="included" className="mt-4 scroll-mt-24 rounded-3xl border border-foreground/10 bg-nebula p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              What&apos;s included
              <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-medium text-muted">{service.features.length}</span>
            </h2>
            <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {service.features.map((f) => (
                <div
                  key={f}
                  className="flex items-start gap-2.5 border-b border-foreground/[0.06] pb-2 last:border-0"
                >
                  <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <Check size={12} strokeWidth={2.6} />
                  </span>
                  <p className="text-sm leading-snug text-foreground">{f}</p>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Paid services → book & pay online. Free/"price on request"
              services → the callback lead form. */}
          {service.priceFrom > 0 ? (
            <ServiceBookingForm service={service} />
          ) : (
            <LeadForm service={service} />
          )}

          <RelatedServices current={service} services={services} category={myCategory} />
        </div>
      </div>
    </Container>
  );
}

/* ------------------------------------------------------------------ *
 * Share row (WhatsApp, X, Facebook, copy link)
 * ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ *
 * Related services: same category first, topped up with popular ones so
 * the row is never empty.
 * ------------------------------------------------------------------ */
const RELATED_LIMIT = 3;

function RelatedServices({
  current,
  services,
  category,
}: {
  current: AstroService;
  services: AstroService[];
  category?: DetailCategory;
}) {
  const { format } = useCurrency();
  const others = services.filter((s) => s.slug !== current.slug);
  const sameCat = current.categoryId ? others.filter((s) => s.categoryId === current.categoryId) : [];
  const byPopular = (a: AstroService, b: AstroService) => Number(b.popular) - Number(a.popular);
  const fill = others.filter((s) => !sameCat.includes(s)).sort(byPopular);
  const list = [...sameCat.sort(byPopular), ...fill].slice(0, RELATED_LIMIT);
  if (list.length === 0) return null;

  const onlyCategory = category && list.every((s) => s.categoryId === category.id);
  const title = onlyCategory ? `More in ${category.name}` : "Related services";
  const viewAll = category && sameCat.length > RELATED_LIMIT ? `/services?category=${category.slug}` : "/services";

  return (
    <section aria-labelledby="related-title" className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">You may also like</p>
          <h2 id="related-title" className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
        <Link href={viewAll} className="inline-flex items-center gap-1 text-sm font-semibold text-gold-600 hover:text-gold-500">
          View all <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => {
          const SIcon = iconMap[s.icon] ?? Sparkles;
          return (
            <article
              key={s.slug}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-400/40 hover:shadow-[0_22px_48px_-28px_rgba(122,69,245,0.45)]"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-royal-500/15 to-gold-400/20">
                {s.image ? (
                  <Image src={s.image} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-gold-600"><SIcon size={36} strokeWidth={1.5} /></span>
                )}
                {s.popular && (
                  <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-gold-600 shadow-sm backdrop-blur">
                    <Star size={10} className="fill-gold-500 text-gold-500" /> Popular
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-3.5">
                <h3 className="text-[15px] font-semibold leading-snug text-foreground">
                  {/* Stretched link: whole card opens the service */}
                  <Link
                    href={`/services/${s.slug}`}
                    className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-gold-600 focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-gold-400/60"
                  >
                    {s.title}
                  </Link>
                </h3>
                {s.tagline && <p className="mt-0.5 line-clamp-1 text-[12.5px] font-medium text-gold-600">{s.tagline}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-foreground/8 pt-3">
                  <p className="truncate text-[15px] font-bold text-foreground">
                    {s.priceFrom === 0 ? "Free" : format(s.priceFrom)}
                    <span className="ml-1 text-[11px] font-normal text-muted">· {s.duration}</span>
                  </p>
                  <ButtonLink href={`/services/${s.slug}#book`} aria-label={`Book ${s.title}`} variant="gold" size="sm" className="relative z-10 shrink-0 gap-1">
                    Book Now <ArrowRight size={13} />
                  </ButtonLink>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ShareRow({ title, slug }: { title: string; slug: string }) {
  const { toast } = useToast();
  // The URL is read on click, so server and client markup always match.
  const urlNow = () => `${window.location.origin}/services/${encodeURIComponent(slug)}`;
  const open = (build: (url: string, text: string) => string) => () => {
    const url = urlNow();
    window.open(build(url, `${title} on Astrounkle`), "_blank", "noopener,noreferrer");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(urlNow());
      toast("Link copied", "success");
    } catch {
      toast("Could not copy the link", "error");
    }
  };
  const btn = "flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2";
  return (
    <div className="mt-4 flex items-center gap-2.5">
      <span className="text-sm font-semibold text-foreground">Share</span>
      <button type="button" aria-label="Share on WhatsApp" onClick={open((u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}`)} className={cn(btn, "bg-[#25D366]")}>
        <MessageCircle size={17} />
      </button>
      <button type="button" aria-label="Share on X" onClick={open((u, t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}`)} className={cn(btn, "bg-[#0f1419]")}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
      </button>
      <button type="button" aria-label="Share on Facebook" onClick={open((u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`)} className={cn(btn, "bg-[#1877F2]")}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" /></svg>
      </button>
      <button type="button" aria-label="Copy link" onClick={copy} className={cn(btn, "bg-foreground/60")}>
        <Link2 size={16} />
      </button>
    </div>
  );
}
/* ------------------------------------------------------------------ *
 * Lead-capture form
 * ------------------------------------------------------------------ */
function LeadForm({ service }: { service: AstroService }) {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<
      string,
      string
    >;

    setSubmitting(true);
    const res = await api.leads.create({
      source: "service",
      name: data.name,
      email: data.email,
      phone: data.phone,
      topic: service.slug,
      message: data.message,
      birth: { date: data.dob, time: data.tob, place: data.pob },
    });
    setSubmitting(false);

    if (res.ok) {
      setSent(true);
      toast("Request received — we'll call you shortly!", "success");
      form.reset();
    } else {
      toast(res.message, "error");
    }
  };

  return (
    <div
      id="book"
      className="scroll-mt-24 mt-4 overflow-hidden rounded-3xl border border-foreground/10 bg-white shadow-[0_18px_44px_-30px_rgba(122,69,245,0.35)] p-5 sm:p-6"
    >
      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center py-6 text-center"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white">
              <CheckCircle2 size={30} />
            </span>
            <h3 className="mt-5 text-2xl font-semibold text-foreground">
              Request Received!
            </h3>
            <p className="mt-2 max-w-sm text-muted">
              Thank you. Our team will reach out within a few hours to schedule
              your <span className="font-medium text-foreground">{service.title}</span>.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-6 text-sm font-semibold text-gold-600 hover:text-gold-500"
            >
              Book another service
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-gold-500" />
              <h2 className="text-xl font-semibold text-foreground">
                Book this Consultation
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              Share your details and our astrologer will connect with you.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Full Name" name="name" required placeholder="Your name" />
                <Field
                  label="Phone / WhatsApp"
                  name="phone"
                  type="tel"
                  required
                  placeholder="+91 00000 00000"
                />
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                />
                <Field label="Date of Birth" name="dob" type="date" required />
                <Field label="Time of Birth" name="tob" type="time" />
                <Field
                  label="Place of Birth"
                  name="pob"
                  placeholder="City, Country"
                />
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">
                  Your Question / Concern
                </span>
                <textarea
                  name="message"
                  rows={3}
                  placeholder="Tell us what you'd like guidance on…"
                  className={cn(inputClass, "resize-none")}
                />
              </label>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <Button
                  type="submit"
                  variant="gold"
                  size="lg"
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : "Request Callback"}
                </Button>
                <span className="text-xs text-muted">
                  🔒 Your details are private & never shared.
                </span>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-foreground/12 bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-rose-mystic"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  );
}
