"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarCheck, Sparkles, Hash, Palette } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

/** Reduce a number to a single digit (numerology). */
function digitSum(n: number): number {
  while (n > 9) n = String(n).split("").reduce((s, d) => s + +d, 0);
  return n;
}

// Ruling planet + lucky info per Mulank (1–9).
const MULANK_INFO: Record<number, { planet: string; color: string; day: string }> = {
  1: { planet: "Sun", color: "Golden / Orange", day: "Sunday" },
  2: { planet: "Moon", color: "White / Cream", day: "Monday" },
  3: { planet: "Jupiter", color: "Yellow", day: "Thursday" },
  4: { planet: "Rahu", color: "Grey / Electric Blue", day: "Sunday" },
  5: { planet: "Mercury", color: "Green", day: "Wednesday" },
  6: { planet: "Venus", color: "Pink / White", day: "Friday" },
  7: { planet: "Ketu", color: "Light Blue", day: "Monday" },
  8: { planet: "Saturn", color: "Dark Blue / Black", day: "Saturday" },
  9: { planet: "Mars", color: "Red", day: "Tuesday" },
};

export function LuckyDatesView() {
  const [result, setResult] = useState<{
    mulank: number;
    bhagyank: number;
    dates: number[];
    info: { planet: string; color: string; day: string };
  } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    if (!f.date) return;
    const [y, m, d] = f.date.split("-").map(Number);
    const mulank = digitSum(d);
    const bhagyank = digitSum(d + m + y);
    // Lucky dates of the month = those whose digit-sum equals mulank or bhagyank.
    const dates: number[] = [];
    for (let i = 1; i <= 31; i++) {
      const ds = digitSum(i);
      if (ds === mulank || ds === bhagyank) dates.push(i);
    }
    setResult({ mulank, bhagyank, dates, info: MULANK_INFO[mulank] });
    setTimeout(() => document.getElementById("lucky-result")?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  return (
    <div className="pb-6">
      <Container className="pt-6">
        <Breadcrumb items={[{ label: "Lucky Dates Calculator" }]} />
      </Container>

      <section className="relative overflow-hidden py-12 sm:py-14">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle, rgba(201,148,42,0.16), transparent 70%)" }} />
        <Container className="relative text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
              <CalendarCheck size={14} /> Numerology · Free
            </span>
            <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
              Lucky Dates &amp; Number{" "}
              <span className="text-gradient-gold">Calculator</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">
              Find your lucky dates, Mulank (root number), Bhagyank (destiny number), ruling planet and
              lucky colour — all from your date of birth, using Vedic numerology.
            </p>
          </motion.div>
        </Container>
      </section>

      <Container>
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-md rounded-[2rem] border border-gold-400/25 bg-gradient-to-br from-gold-400/[0.06] to-nebula p-6 sm:p-8"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Date of Birth</span>
            <input name="date" type="date" className={inputClass} required />
          </label>
          <Button type="submit" variant="gold" size="lg" className="mt-5 w-full">
            <CalendarCheck size={16} /> Find My Lucky Dates
          </Button>
        </motion.form>
      </Container>

      <AnimatePresence>
        {result && (
          <motion.section id="lucky-result" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="scroll-mt-24 py-14">
            <Container>
              <div className="mx-auto max-w-2xl">
                <div className="grid grid-cols-2 gap-4">
                  <NumCard icon={Hash} label="Mulank (Root No.)" value={result.mulank} />
                  <NumCard icon={Sparkles} label="Bhagyank (Destiny No.)" value={result.bhagyank} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <InfoCard label="Ruling Planet" value={result.info.planet} />
                  <InfoCard label="Lucky Day" value={result.info.day} />
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-foreground/10 bg-nebula p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600"><Palette size={18} /></span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Lucky Colour</p>
                    <p className="font-semibold text-foreground">{result.info.color}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-gold-400/25 bg-gradient-to-br from-gold-400/[0.07] to-nebula p-6 text-center">
                  <p className="text-sm text-muted">Your lucky dates each month</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {result.dates.map((d) => (
                      <span key={d} className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400/15 text-sm font-bold text-gold-700">{d}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-8 rounded-[2rem] bg-gradient-to-br from-royal-500 to-royal-700 p-7 text-center text-white">
                  <h3 className="font-display text-xl font-semibold">Want a full numerology reading?</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-white/80">Our astrologers combine numerology with your kundli for precise timing and remedies.</p>
                  <Link href="/#free-consultation" className="mt-5 inline-block"><Button variant="gold" size="lg">Talk to an Expert</Button></Link>
                </div>
              </div>
            </Container>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="bg-void py-16">
        <Container>
          <SectionHeader eyebrow="Numerology" title={<>About Mulank &amp; <span className="text-gradient-gold">Bhagyank</span></>} className="mb-8" />
          <div className="mx-auto max-w-3xl space-y-4 text-sm leading-relaxed text-muted">
            <p>
              In Vedic numerology, your <strong className="text-foreground">Mulank</strong> (root number) is the
              single digit from your date of birth, and your <strong className="text-foreground">Bhagyank</strong>{" "}
              (destiny number) comes from your full date. Each number is ruled by a planet and carries lucky
              dates, days and colours that help you time important events.
            </p>
            <p>
              Choosing favourable dates for weddings, launches, signings and travel is a popular use of
              numerology. For precise muhurat combined with your birth chart, book a consultation.
            </p>
          </div>
        </Container>
      </section>
    </div>
  );
}

function NumCard({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-nebula p-5 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600"><Icon size={18} /></span>
      <p className="mt-2 text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-3xl font-bold text-gradient-gold">{value}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-nebula p-5 text-center">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
