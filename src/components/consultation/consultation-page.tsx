"use client";

/**
 * /consultation — information about online consultation, the request form
 * (same form as the astrologer "Consult Now" popup) and FAQs.
 */

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowDown, BadgeCheck, Briefcase, CalendarCheck2, ChevronDown, ClipboardList, GraduationCap, HandHeart, Heart, HeartPulse, Lock, MessageCircle,
  PhoneCall, ScrollText, Sparkles, Star, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SectionHeader } from "@/components/ui/section-header";
import { ButtonLink } from "@/components/ui/button";
import { ConsultationForm } from "@/components/astrology/consultation-modal";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";
import { cn } from "@/lib/utils";
import type { ConsultationFaq } from "@/data/consultation-faqs";

const ease = [0.22, 1, 0.36, 1] as const;

const STATS = [
  { value: "25,000+", label: "Consultations" },
  { value: "4.9★", label: "Average rating" },
  { value: "15+", label: "Years of practice" },
];

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ClipboardList, title: "Share your details", text: "Fill the short form with your birth details and your question." },
  { icon: PhoneCall, title: "We call you back", text: "Our team calls to confirm the time and the astrologer for you." },
  { icon: ScrollText, title: "Your chart is studied", text: "The astrologer prepares your kundli before the session." },
  { icon: HandHeart, title: "Talk and get remedies", text: "Clear answers on call, chat or video, with practical remedies." },
];

const TOPICS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Briefcase, title: "Career & job", text: "Job change, promotion, government job, business timing." },
  { icon: Heart, title: "Love & relationships", text: "Compatibility, misunderstandings, the right partner." },
  { icon: Users, title: "Marriage", text: "Delays in marriage, kundli matching, married life." },
  { icon: Wallet, title: "Money & finance", text: "Savings, debts, investments and growth." },
  { icon: HeartPulse, title: "Health", text: "Planetary influences on health and well-being." },
  { icon: GraduationCap, title: "Education", text: "Studies, competitive exams, going abroad." },
];

const WHY = [
  "Verified Vedic astrologers with real experience",
  "Reading from your exact birth chart",
  "Practical remedies, no fear and no pressure",
  "100% private and confidential",
];

const AVATARS = ["/astrologers/a7.webp", "/astrologers/a12.webp", "/astrologers/a10.webp", "/astrologers/a5-avatar.webp"];

export function ConsultationPage({ faqs }: { faqs: ConsultationFaq[] }) {
  const reduce = useReducedMotion();
  const store = useStoreSettings();
  const WA = `https://wa.me/${phoneDigits(store.whatsappNumber)}`;
  const fade = (delay = 0) => ({
    initial: reduce ? false : ({ opacity: 0, y: 18 } as const),
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.5, delay, ease },
  });

  return (
    <div className="pb-10">
      {/* ---------------- hero ---------------- */}
      <section className="relative isolate overflow-hidden border-b border-gold-400/20 bg-[#f6f0fb] lg:min-h-[30rem]">
        {/* background art: empty light area on the left, ritual items on the right */}
        <motion.div
          aria-hidden
          className="absolute inset-0 -z-10"
          initial={reduce ? false : { scale: 1.06, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease }}
        >
          <Image
            src="/images/consulting-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[78%_center] lg:object-right"
          />
        </motion.div>
        {/* readability: soft white fade behind the text (stronger on small screens) */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-white/70 lg:hidden" />
        <div aria-hidden className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-white/85 via-white/55 to-transparent lg:block" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-16 bg-gradient-to-t from-white/60 to-transparent" />

        <Container className="relative py-6 sm:py-8 lg:py-10">
          <Breadcrumb items={[{ label: "Consultation" }]} />
          <div className="mt-4 max-w-2xl">
            <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-600">Online Astrology Consultation</p>
              <h1 className="mt-1.5 font-display text-[1.9rem] font-semibold leading-tight text-foreground sm:text-[2.4rem]">
                Talk to a Verified <span className="text-gradient-gold">Vedic Astrologer</span>
              </h1>
              <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-muted">
                Get clear, honest answers on career, marriage, love, health and money from astrologers who read your birth chart with care. Share your details and we call you back to schedule your session.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <ButtonLink href="#consult-form" variant="gold" size="lg" className="gap-1.5 px-7">
                  Book Consultation <ArrowDown size={16} />
                </ButtonLink>
                <a href={WA} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-full border border-foreground/15 bg-white px-5 text-sm font-medium text-foreground transition-colors hover:border-gold-400/60 hover:text-gold-600">
                  <MessageCircle size={15} /> Chat on WhatsApp
                </a>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex -space-x-2.5">
                  {AVATARS.map((src) => (
                    <span key={src} className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-white">
                      <Image src={src} alt="" fill sizes="36px" className="object-cover object-top" />
                    </span>
                  ))}
                </div>
                <p className="text-[13px] text-muted">
                  <span className="flex items-center gap-0.5 font-semibold text-foreground">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} className="fill-gold-500 text-gold-500" />)}
                    <span className="ml-1">4.9 / 5</span>
                  </span>
                  Trusted by 25,000+ people
                </p>
              </div>
            </motion.div>

            {/* stats sit under the text so the artwork on the right stays visible */}
            <motion.ul initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15, ease }}
              className="mt-6 grid max-w-lg grid-cols-3 overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-[0_20px_50px_-30px_rgba(76,40,140,0.45)] backdrop-blur-md">
              {STATS.map((s, i) => (
                <li key={s.label} className={cn("px-3 py-4 text-center", i > 0 && "border-l border-foreground/8")}>
                  <p className="font-display text-xl font-semibold text-gradient-gold sm:text-2xl">{s.value}</p>
                  <p className="mt-0.5 text-[10.5px] font-medium uppercase tracking-wider text-muted sm:text-[11px]">{s.label}</p>
                </li>
              ))}
            </motion.ul>
          </div>
        </Container>
      </section>

      {/* ---------------- how it works ---------------- */}
      <section aria-labelledby="how-title" className="py-9 md:py-11">
        <Container>
          <SectionHeader eyebrow="Simple Process" title={<span id="how-title">How Your <span className="text-gradient-gold">Consultation Works</span></span>} />
          <ol className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <motion.li key={s.title} {...fade(i * 0.07)} whileHover={reduce ? undefined : { y: -4 }}
                className="group relative rounded-2xl border border-foreground/10 bg-white p-5 shadow-[0_14px_36px_-30px_rgba(36,26,59,0.45)] transition-[border-color,box-shadow] hover:border-gold-400/50 hover:shadow-[0_24px_50px_-30px_rgba(201,148,42,0.55)]">
                <span className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-[0_10px_22px_-12px_rgba(201,148,42,0.9)]">
                    <s.icon size={20} />
                  </span>
                  <span className="font-display text-3xl font-bold text-foreground/[0.07] transition-colors group-hover:text-gold-400/30">{String(i + 1).padStart(2, "0")}</span>
                </span>
                <h3 className="mt-3 text-[15px] font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.text}</p>
              </motion.li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ---------------- topics ---------------- */}
      <section aria-labelledby="topics-title" className="bg-gradient-to-b from-gold-400/[0.06] to-transparent py-9 md:py-11">
        <Container>
          <SectionHeader eyebrow="Ask About Anything" title={<span id="topics-title">What You Can <span className="text-gradient-gold">Get Guidance On</span></span>} />
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOPICS.map((t, i) => (
              <motion.li key={t.title} {...fade(i * 0.05)}
                className="group flex items-start gap-3 rounded-2xl border border-foreground/10 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-400/50 hover:shadow-[0_20px_44px_-30px_rgba(201,148,42,0.55)]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/12 to-gold-400/20 text-gold-600 transition-colors duration-300 group-hover:from-gold-400 group-hover:to-gold-500 group-hover:text-white">
                  <t.icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{t.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{t.text}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ---------------- form ---------------- */}
      <section id="consult-form" aria-labelledby="form-title" className="scroll-mt-24 py-9 md:py-11">
        <Container>
          <div className="grid gap-5 lg:grid-cols-[20rem_1fr] lg:items-start">
            <motion.aside {...fade()} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-royal-600 to-royal-800 p-5 text-white lg:sticky lg:top-24">
              <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold-400/25 blur-3xl" />
              <p className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">Why Astrounkle</p>
              <h2 className="relative mt-1 text-xl font-semibold leading-snug">Guidance you can trust</h2>
              <ul className="relative mt-4 space-y-2.5">
                {WHY.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-[13.5px] text-white/90">
                    <BadgeCheck size={16} className="mt-0.5 shrink-0 text-gold-300" /> {w}
                  </li>
                ))}
              </ul>
              <div className="relative mt-5 space-y-2 border-t border-white/15 pt-4 text-[13px] text-white/80">
                <p className="flex items-center gap-2"><CalendarCheck2 size={15} className="text-gold-300" /> Call back within working hours</p>
                <p className="flex items-center gap-2"><Lock size={15} className="text-gold-300" /> Your details are never shared</p>
              </div>
              <a href={WA} target="_blank" rel="noopener noreferrer" className="relative mt-5 flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20">
                <MessageCircle size={15} /> Prefer WhatsApp? Chat now
              </a>
            </motion.aside>

            <motion.div {...fade(0.05)} className="rounded-2xl border border-foreground/10 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(36,26,59,0.5)] sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-[0_10px_22px_-12px_rgba(201,148,42,0.9)]"><Sparkles size={20} /></span>
                <div>
                  <h2 id="form-title" className="text-lg font-semibold text-foreground">Book your consultation</h2>
                  <p className="text-sm text-muted">Takes about a minute. Fields marked * are required.</p>
                </div>
              </div>
              <ConsultationForm layout="page" />
            </motion.div>
          </div>
        </Container>
      </section>

      {/* ---------------- FAQ ---------------- */}
      {faqs.length > 0 && (
        <section aria-labelledby="faq-title" className="pb-2 pt-2">
          <Container>
            <SectionHeader eyebrow="FAQ" title={<span id="faq-title">Frequently Asked <span className="text-gradient-gold">Questions</span></span>} />
            <div className="mx-auto mt-6 max-w-3xl divide-y divide-foreground/8 overflow-hidden rounded-2xl border border-foreground/10 bg-white shadow-[0_18px_44px_-34px_rgba(36,26,59,0.45)]">
              {faqs.map((f, i) => <Faq key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} />)}
            </div>
            <p className="mt-4 text-center text-sm text-muted">
              Still have a question?{" "}
              <a href={WA} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold-600 hover:text-gold-500">Ask us on WhatsApp</a>
            </p>
          </Container>
        </section>
      )}
    </div>
  );
}

function Faq({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const reduce = useReducedMotion();
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-[14.5px] font-medium text-foreground transition-colors hover:bg-gold-400/[0.04]">
        {q}
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors", open ? "bg-gold-400/15 text-gold-600" : "bg-foreground/5 text-muted")}>
          <ChevronDown size={15} className={cn("transition-transform duration-200", open && "rotate-180")} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <p className="px-5 pb-4 text-[13.5px] leading-relaxed text-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
