"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Loader2, ArrowRight, Sparkles, Check, X } from "lucide-react";
import type { MatchingResponse } from "@/types/astrology";
import { shopApi } from "@/lib/shop-api";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SectionHeader } from "@/components/ui/section-header";
import { CityInput } from "./city-input";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

const verdictMeta: Record<MatchingResponse["result"]["verdict"], { label: string; color: string }> = {
  excellent: { label: "Excellent Match", color: "text-emerald-600" },
  good: { label: "Good Match", color: "text-emerald-600" },
  average: { label: "Average Match", color: "text-amber-600" },
  "not-recommended": { label: "Needs Review", color: "text-rose-600" },
};

export function KundliMatchingView() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<MatchingResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    if (!f.boy_date || !f.boy_place || !f.girl_date || !f.girl_place) {
      setError("Please enter both partners' date and place of birth.");
      return;
    }
    setLoading(true);
    const res = await shopApi.astrology.matching({
      boy: { name: f.boy_name, date: f.boy_date, time: f.boy_time || "12:00", place: f.boy_place },
      girl: { name: f.girl_name, date: f.girl_date, time: f.girl_time || "12:00", place: f.girl_place },
    });
    setLoading(false);
    if (res.ok) {
      setData(res.data);
      setTimeout(() => document.getElementById("match-result")?.scrollIntoView({ behavior: "smooth" }), 80);
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="pb-6">
      <Container className="pt-6">
        <Breadcrumb items={[{ label: "Kundli Matching" }]} />
      </Container>

      {/* Hero */}
      <section className="relative overflow-hidden py-12 sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(224,90,144,0.16), transparent 70%)" }}
        />
        <Container className="relative text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
              <Heart size={14} /> Ashtakoot · 36 Gunas
            </span>
            <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
              Free Kundli Matching for{" "}
              <span className="text-gradient-gold">Marriage</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">
              Check marriage compatibility online with Gun Milan (Ashtakoot). Enter both
              partners&apos; birth details to see your score out of 36 gunas across all eight
              kootas — Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot and Nadi.
            </p>
          </motion.div>
        </Container>
      </section>

      {/* Form */}
      <Container>
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-4xl"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <PartnerCard prefix="boy" title="Groom's Details" accent="from-royal-500/10" />
            <PartnerCard prefix="girl" title="Bride's Details" accent="from-rose-mystic/10" />
          </div>
          {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p>}
          <div className="mt-6 flex justify-center">
            <Button type="submit" variant="gold" size="lg" disabled={loading}>
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Matching…</>
              ) : (
                <><Heart size={16} /> Match Kundli Now</>
              )}
            </Button>
          </div>
        </motion.form>
      </Container>

      {/* Result */}
      <AnimatePresence>
        {data && (
          <motion.section id="match-result" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="scroll-mt-24 py-14">
            <Container>
              <div className="mx-auto max-w-4xl">
                {/* score ring */}
                <div className="flex flex-col items-center text-center">
                  <ScoreDial total={data.result.total} />
                  <h2 className={cn("mt-5 font-display text-3xl font-bold", verdictMeta[data.result.verdict].color)}>
                    {verdictMeta[data.result.verdict].label}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{data.result.summary}</p>
                </div>

                {/* partner summary */}
                <div className="mt-8 grid grid-cols-2 gap-4">
                  {[data.boy, data.girl].map((p, i) => (
                    <div key={i} className="rounded-2xl border border-foreground/10 bg-nebula p-5 text-center">
                      <p className="font-display text-lg font-semibold text-foreground">{p.name}</p>
                      <p className="mt-1 text-xs text-muted">{p.place}</p>
                      <p className="mt-2 text-sm text-foreground">{p.moonSign} · <span className="text-gold-600">{p.nakshatra}</span></p>
                    </div>
                  ))}
                </div>

                {/* koota breakdown */}
                <div className="mt-8 overflow-hidden rounded-2xl border border-foreground/10 bg-nebula">
                  <div className="grid grid-cols-[1.6fr_0.8fr_2fr] gap-2 border-b border-foreground/10 bg-void/50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    <span>Koota</span><span>Score</span><span>Meaning</span>
                  </div>
                  {data.result.koots.map((k) => (
                    <div key={k.name} className="grid grid-cols-[1.6fr_0.8fr_2fr] items-center gap-2 border-b border-foreground/8 px-5 py-3 text-sm last:border-0">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        {k.got >= k.max / 2
                          ? <Check size={14} className="text-emerald-600" />
                          : <X size={14} className="text-rose-500" />}
                        {k.name}
                      </span>
                      <span className="font-semibold text-foreground">{k.got} / {k.max}</span>
                      <span className="text-muted">{k.note}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-gold-400/10 px-5 py-3.5 text-sm font-semibold text-foreground">
                    <span>Total Gun Milan</span>
                    <span className="text-gold-700">{data.result.total} / 36</span>
                  </div>
                </div>

                <p className="mt-4 rounded-xl border border-foreground/10 bg-void/50 px-5 py-4 text-sm text-muted">
                  {data.result.manglikNote}
                </p>

                {/* CTA */}
                <div className="mt-8 flex flex-col items-center gap-4 rounded-[2rem] bg-gradient-to-br from-royal-500 to-royal-700 p-7 text-center text-white sm:flex-row sm:justify-between sm:text-left">
                  <div>
                    <h3 className="font-display text-xl font-semibold">Want a detailed matchmaking report?</h3>
                    <p className="mt-1 max-w-md text-sm text-white/80">Our astrologers review doshas, Manglik status and remedies for a confident decision.</p>
                  </div>
                  <Link href="/#free-consultation" className="shrink-0">
                    <Button variant="gold" size="lg">Talk to an Astrologer <ArrowRight size={16} /></Button>
                  </Link>
                </div>
              </div>
            </Container>
          </motion.section>
        )}
      </AnimatePresence>

      {/* SEO prose */}
      <section className="bg-void py-16">
        <Container>
          <SectionHeader eyebrow="How It Works" title={<>Understanding <span className="text-gradient-gold">Gun Milan</span></>} className="mb-10" />
          <div className="mx-auto max-w-3xl space-y-5 text-sm leading-relaxed text-muted">
            <p>
              Kundli Matching (also called Gun Milan, Guna Milap, Horoscope Matching or Kundali
              Milan) is the traditional Vedic method of checking marriage compatibility between a
              bride and groom. It compares the Moon&apos;s Nakshatra and Rashi in both horoscopes
              across eight kootas, awarding up to 36 gunas in total.
            </p>
            <h2 className="font-display text-2xl font-semibold text-foreground">The 8 Kootas (Ashtakoot)</h2>
            <p>
              <strong className="text-foreground">Varna</strong> (1) reflects spiritual compatibility;{" "}
              <strong className="text-foreground">Vashya</strong> (2) mutual attraction;{" "}
              <strong className="text-foreground">Tara</strong> (3) health and destiny;{" "}
              <strong className="text-foreground">Yoni</strong> (4) physical compatibility;{" "}
              <strong className="text-foreground">Graha Maitri</strong> (5) mental bonding;{" "}
              <strong className="text-foreground">Gana</strong> (6) temperament;{" "}
              <strong className="text-foreground">Bhakoot</strong> (7) love, family and finances; and{" "}
              <strong className="text-foreground">Nadi</strong> (8) health and progeny — the most important koota.
            </p>
            <h2 className="font-display text-2xl font-semibold text-foreground">What score is good?</h2>
            <p>
              A total of 18 or more gunas out of 36 is traditionally considered an acceptable match,
              and 28+ is excellent. A lower score, or a Nadi/Bhakoot dosha, does not always rule out
              marriage — many doshas have well-established remedies. For a complete analysis including
              Manglik dosha, book a consultation with our astrologers.
            </p>
          </div>
        </Container>
      </section>
    </div>
  );
}

function PartnerCard({ prefix, title, accent }: { prefix: string; title: string; accent: string }) {
  return (
    <div className={cn("rounded-[2rem] border border-foreground/10 bg-gradient-to-br to-nebula p-6 sm:p-7", accent)}>
      <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Sparkles size={16} className="text-gold-500" /> {title}
      </h3>
      <div className="mt-5 space-y-4">
        <Labeled label="Name (optional)">
          <input name={`${prefix}_name`} className={inputClass} placeholder="Name" />
        </Labeled>
        <Labeled label="Date of Birth" required>
          <input name={`${prefix}_date`} type="date" className={inputClass} required />
        </Labeled>
        <Labeled label="Time of Birth">
          <input name={`${prefix}_time`} type="time" className={inputClass} />
        </Labeled>
        <Labeled label="Place of Birth" required>
          <CityInput name={`${prefix}_place`} placeholder="Start typing city…" />
        </Labeled>
      </div>
    </div>
  );
}

function Labeled({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}{required && <span className="text-rose-mystic"> *</span>}
      </span>
      {children}
    </label>
  );
}

function ScoreDial({ total }: { total: number }) {
  const pct = Math.min(total / 36, 1);
  const r = 54;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-foreground/10" />
        <motion.circle
          cx="64" cy="64" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
          className="text-gold-500"
          stroke="currentColor"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-foreground">{total}</span>
        <span className="text-xs text-muted">of 36</span>
      </div>
    </div>
  );
}
