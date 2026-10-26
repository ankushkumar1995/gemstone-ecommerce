"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

const FLAMES = ["Friends", "Lovers", "Affectionate", "Marriage", "Enemies", "Siblings"];

/** Classic FLAMES game — cancel common letters, count the rest, cycle F-L-A-M-E-S. */
function flames(a: string, b: string): string {
  const n1 = a.toLowerCase().replace(/[^a-z]/g, "").split("");
  const n2 = b.toLowerCase().replace(/[^a-z]/g, "").split("");
  for (let i = n1.length - 1; i >= 0; i--) {
    const j = n2.indexOf(n1[i]);
    if (j !== -1) {
      n1.splice(i, 1);
      n2.splice(j, 1);
    }
  }
  const count = n1.length + n2.length;
  if (count === 0) return "Lovers";
  const list = [...FLAMES];
  let idx = 0;
  while (list.length > 1) {
    idx = (idx + count - 1) % list.length;
    list.splice(idx, 1);
  }
  return list[0];
}

/** A stable, fun "love percentage" from the two names (deterministic). */
function lovePercent(a: string, b: string): number {
  const s = (a + b).toLowerCase().replace(/[^a-z]/g, "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
  return 55 + (h % 45); // 55–99 (keeps it feel-good)
}

const resultCopy: Record<string, string> = {
  Lovers: "The stars lean towards romance — a warm, loving connection.",
  Marriage: "A bond built to last — this pairing points towards commitment.",
  Affectionate: "Gentle warmth and deep care define this connection.",
  Friends: "A strong, easy friendship is the heart of this match.",
  Siblings: "A protective, family-like bond — comfort over sparks.",
  Enemies: "Fiery energy! Opposites that challenge and grow each other.",
};

export function LoveCalculatorView() {
  const [result, setResult] = useState<{ pct: number; flame: string; a: string; b: string } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    if (!f.a?.trim() || !f.b?.trim()) return;
    setResult({ pct: lovePercent(f.a, f.b), flame: flames(f.a, f.b), a: f.a.trim(), b: f.b.trim() });
    setTimeout(() => document.getElementById("love-result")?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  return (
    <div className="pb-6">
      <Container className="pt-6">
        <Breadcrumb items={[{ label: "Love Calculator" }]} />
      </Container>

      <section className="relative overflow-hidden py-12 sm:py-14">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle, rgba(224,90,144,0.18), transparent 70%)" }} />
        <Container className="relative text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
              <Heart size={14} /> Love & FLAMES · Just for fun
            </span>
            <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
              Love &amp; Flames{" "}
              <span className="text-gradient-gold">Calculator</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">
              Enter two names to see your fun love percentage and FLAMES result. A light-hearted
              compatibility check — for real astrological matchmaking, try our Kundli Matching.
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
          className="mx-auto max-w-3xl rounded-[2rem] border border-gold-400/25 bg-gradient-to-br from-gold-400/[0.06] to-nebula p-6 sm:p-8"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Your Name</span>
              <input name="a" className={inputClass} placeholder="e.g. Rahul" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Partner&apos;s Name</span>
              <input name="b" className={inputClass} placeholder="e.g. Priya" />
            </label>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <Button type="submit" variant="gold" size="lg"><Heart size={16} /> Calculate Love</Button>
            <span className="text-xs text-muted">Just for fun · instant</span>
          </div>
        </motion.form>
      </Container>

      <AnimatePresence>
        {result && (
          <motion.section id="love-result" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="scroll-mt-24 py-14">
            <Container>
              <div className="mx-auto max-w-xl text-center">
                <div className="relative mx-auto mb-6 h-32 w-32">
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 14 }}
                    className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-rose-mystic to-gold-500 text-white shadow-[0_18px_40px_-16px_rgba(224,90,144,0.6)]"
                  >
                    <div>
                      <span className="font-display text-4xl font-bold">{result.pct}%</span>
                      <Heart size={16} className="mx-auto mt-0.5 fill-white" />
                    </div>
                  </motion.div>
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  {result.a} &amp; {result.b}
                </h2>
                <p className="mt-1 text-lg font-semibold text-gold-600">FLAMES: {result.flame}</p>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">{resultCopy[result.flame]}</p>

                <div className="mt-8 rounded-[2rem] bg-gradient-to-br from-royal-500 to-royal-700 p-7 text-center text-white">
                  <h3 className="font-display text-xl font-semibold">Want the real compatibility?</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
                    FLAMES is just for fun. For a true marriage match, check Ashtakoot Gun Milan with
                    both birth charts.
                  </p>
                  <Link href="/kundli-matching" className="mt-5 inline-block">
                    <Button variant="gold" size="lg">Try Kundli Matching <ArrowRight size={16} /></Button>
                  </Link>
                </div>
              </div>
            </Container>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="bg-void py-16">
        <Container>
          <SectionHeader eyebrow="How it works" title={<>About the <span className="text-gradient-gold">Love Calculator</span></>} className="mb-8" />
          <div className="mx-auto max-w-3xl space-y-4 text-sm leading-relaxed text-muted">
            <p>
              The Love Calculator and the classic FLAMES game are light-hearted ways to check the vibe
              between two names. FLAMES stands for Friends, Lovers, Affectionate, Marriage, Enemies and
              Siblings — a nostalgic game loved across generations. It&apos;s all in good fun and not a
              substitute for real astrological compatibility.
            </p>
            <p>
              For a genuine marriage match based on your birth charts, use our{" "}
              <Link href="/kundli-matching" className="font-semibold text-gold-600 hover:underline">Kundli Matching (Gun Milan)</Link>{" "}
              tool, which scores compatibility out of 36 gunas across eight kootas.
            </p>
          </div>
        </Container>
      </section>
    </div>
  );
}
