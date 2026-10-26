"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Sun,
  Moon,
  Star,
  Compass,
  ArrowRight,
  Gem,
} from "lucide-react";
import type { KundliResponse } from "@/types/astrology";
import { shopApi } from "@/lib/shop-api";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";
import { CityInput } from "./city-input";

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

const highlights = [
  { icon: Compass, title: "Lagna (Ascendant)", desc: "Your rising sign — the lens through which you meet the world." },
  { icon: Moon, title: "Moon Sign & Nakshatra", desc: "Your Rashi and birth star — the core of Vedic astrology." },
  { icon: Sun, title: "All 9 Planets", desc: "Sidereal positions of the Navagraha with retrograde status." },
  { icon: Gem, title: "Gemstone Guidance", desc: "A matching stone recommendation based on your chart." },
];

export function FreeKundliView() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<KundliResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    if (!f.date || !f.place) {
      setError("Please enter your date and place of birth.");
      return;
    }
    setLoading(true);
    const res = await shopApi.astrology.kundli({
      name: f.name,
      date: f.date,
      time: f.time || "12:00",
      place: f.place,
    });
    setLoading(false);
    if (res.ok) {
      setData(res.data);
      setTimeout(
        () => document.getElementById("kundli-result")?.scrollIntoView({ behavior: "smooth" }),
        80,
      );
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="pb-6">
      <Container className="pt-6">
        <Breadcrumb items={[{ label: "Free Kundli" }]} />
      </Container>

      {/* Hero */}
      <section className="relative overflow-hidden py-12 sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(145,105,255,0.18), transparent 70%)" }}
        />
        <Container className="relative text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
              <Sparkles size={14} /> 100% Free · Instant
            </span>
            <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
              Free Janam Kundli &{" "}
              <span className="text-gradient-gold">Birth Chart Online</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted">
              Generate your free online kundli by date of birth in seconds. Get your
              Lagna, Moon sign (Rashi), Nakshatra and the sidereal positions of all nine
              planets — calculated with the Lahiri ayanamsa used in authentic Vedic astrology.
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
          className="mx-auto max-w-3xl rounded-[2rem] border border-gold-400/25 bg-gradient-to-br from-gold-400/[0.06] to-nebula p-6 sm:p-8"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-gold-500" />
            <h2 className="text-xl font-semibold text-foreground">Enter Your Birth Details</h2>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Labeled label="Name (optional)">
              <input name="name" className={inputClass} placeholder="Your name" />
            </Labeled>
            <Labeled label="Date of Birth" required>
              <input name="date" type="date" className={inputClass} required />
            </Labeled>
            <Labeled label="Time of Birth">
              <input name="time" type="time" className={inputClass} />
            </Labeled>
            <Labeled label="Place of Birth" required>
              <CityInput name="place" placeholder="Start typing your city…" />
            </Labeled>
          </div>
          {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button type="submit" variant="gold" size="lg" disabled={loading}>
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Generating…</>
              ) : (
                <>Generate Free Kundli <ArrowRight size={16} /></>
              )}
            </Button>
            <span className="text-xs text-muted">No sign-up needed · Instant result</span>
          </div>
          <p className="mt-3 text-xs text-muted">
            Tip: an accurate time of birth gives a precise Ascendant (Lagna). If unknown,
            we use noon as a reasonable default.
          </p>
        </motion.form>
      </Container>

      {/* Result */}
      <AnimatePresence>
        {data && (
          <motion.section
            id="kundli-result"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="scroll-mt-24 py-14"
          >
            <Container>
              <SectionHeader
                eyebrow={`${data.name}'s Chart`}
                title={<>Your Vedic <span className="text-gradient-gold">Kundli</span></>}
                description={`Born in ${data.place}, ${data.country}. Calculated using the Lahiri (Chitrapaksha) ayanamsa.`}
                className="mb-10"
              />

              {/* key placements */}
              <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
                <KeyCard icon={Compass} label="Ascendant (Lagna)" value={data.kundli.ascendant.rashi} sub={data.kundli.ascendant.rashiSanskrit} />
                <KeyCard icon={Moon} label="Moon Sign (Rashi)" value={data.kundli.moonSign.rashi} sub={data.kundli.moonSign.rashiSanskrit} />
                <KeyCard icon={Sun} label="Sun Sign" value={data.kundli.sunSign.rashi} sub={data.kundli.sunSign.rashiSanskrit} />
              </div>

              <div className="mx-auto mt-4 max-w-4xl rounded-2xl border border-foreground/10 bg-nebula p-5 text-center">
                <p className="text-sm text-muted">
                  Birth Nakshatra:{" "}
                  <span className="font-semibold text-foreground">{data.kundli.nakshatra.name}</span>{" "}
                  (Pada {data.kundli.nakshatra.pada}) · Ruling planet:{" "}
                  <span className="font-semibold text-gold-600">{data.kundli.nakshatra.lord}</span>
                </p>
              </div>

              {/* planet table */}
              <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-2xl border border-foreground/10 bg-nebula">
                <div className="grid grid-cols-[1.2fr_1.4fr_0.8fr_1.6fr] gap-2 border-b border-foreground/10 bg-void/50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  <span>Planet</span><span>Rashi</span><span>Degree</span><span>Nakshatra</span>
                </div>
                {data.kundli.planets.map((p) => (
                  <div key={p.planet} className="grid grid-cols-[1.2fr_1.4fr_0.8fr_1.6fr] gap-2 border-b border-foreground/8 px-5 py-3 text-sm last:border-0">
                    <span className="font-medium text-foreground">
                      {p.planet}{p.retrograde && <span className="ml-1 text-xs text-rose-mystic">(R)</span>}
                    </span>
                    <span className="text-foreground">{p.rashi}</span>
                    <span className="text-muted">{p.degreeInSign.toFixed(1)}°</span>
                    <span className="text-muted">{p.nakshatra} ({p.nakshatraPada})</span>
                  </div>
                ))}
              </div>

              {/* CTA to gemstone + consultation */}
              <div className="mx-auto mt-8 flex max-w-4xl flex-col items-center gap-4 rounded-[2rem] bg-gradient-to-br from-royal-500 to-royal-700 p-7 text-center text-white sm:flex-row sm:justify-between sm:text-left">
                <div>
                  <h3 className="font-display text-xl font-semibold">Want the full reading?</h3>
                  <p className="mt-1 max-w-md text-sm text-white/80">
                    Get a gemstone recommendation and personalised remedies from our Vedic astrologers.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3">
                  <Link href="/#free-consultation"><Button variant="gold" size="lg">Free Consultation</Button></Link>
                  <Link href="/shop"><Button variant="ghost" size="lg" className="border border-white/30 bg-white/10 text-white hover:bg-white/20">Shop Gemstones</Button></Link>
                </div>
              </div>
            </Container>
          </motion.section>
        )}
      </AnimatePresence>

      {/* SEO content — what's included */}
      <section className="bg-void py-16">
        <Container>
          <SectionHeader
            eyebrow="What You Get"
            title={<>Inside Your Free <span className="text-gradient-gold">Kundli</span></>}
            className="mb-12"
          />
          <StaggerContainer className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
            {highlights.map((h) => (
              <motion.div key={h.title} variants={staggerItem} whileHover={{ y: -5 }} className="rounded-3xl border border-foreground/10 bg-nebula p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600">
                  <h.icon size={20} />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">{h.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{h.desc}</p>
              </motion.div>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      {/* SEO prose */}
      <section className="py-16">
        <Container>
          <div className="mx-auto max-w-3xl space-y-5 text-sm leading-relaxed text-muted">
            <h2 className="font-display text-2xl font-semibold text-foreground">What is a Janam Kundli?</h2>
            <p>
              A Janam Kundli, or birth chart, is a snapshot of the sky at the exact moment
              you were born. In Vedic astrology it maps the position of the nine planets
              (Navagraha) across the twelve zodiac signs (Rashis) and twenty-seven lunar
              mansions (Nakshatras). Your free online kundli reveals your Ascendant (Lagna),
              Moon sign and birth star — the foundations every astrologer uses to read your
              personality, strengths, career, marriage and the right time to act.
            </p>
            <h2 className="font-display text-2xl font-semibold text-foreground">Why your Moon sign matters most</h2>
            <p>
              Unlike Western astrology, which leans on the Sun sign, Vedic astrology treats
              the Moon sign (Rashi) and its Nakshatra as the heart of the chart. It governs
              your mind, emotions and the Vimshottari Dasha periods that time the events of
              your life. That&apos;s why kundli matching for marriage is based on the
              Moon&apos;s Nakshatra of both partners.
            </p>
            <h2 className="font-display text-2xl font-semibold text-foreground">From chart to the right gemstone</h2>
            <p>
              Once your chart is cast, a weak or afflicted planet can often be strengthened
              with its corresponding gemstone — a Blue Sapphire (Neelam) for Saturn, Yellow
              Sapphire (Pukhraj) for Jupiter, Ruby (Manik) for the Sun, and so on. Book a free
              consultation and our astrologers will recommend a certified, energised stone
              matched to your kundli.
            </p>
          </div>
        </Container>
      </section>
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

function KeyCard({ icon: Icon, label, value, sub }: { icon: typeof Sun; label: string; value: string; sub: string }) {
  return (
    <motion.div whileHover={{ y: -4 }} className="rounded-2xl border border-foreground/10 bg-nebula p-5 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600">
        <Icon size={19} />
      </span>
      <p className="mt-3 text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-foreground">{value}</p>
      <p className="flex items-center justify-center gap-1 text-xs text-gold-600"><Star size={10} className="fill-gold-500 text-gold-500" />{sub}</p>
    </motion.div>
  );
}
