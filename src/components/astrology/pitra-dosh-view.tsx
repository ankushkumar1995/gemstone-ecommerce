"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Flower2,
  Check,
  AlertTriangle,
  TrendingDown,
  HeartCrack,
  Baby,
  Home,
  Coins,
  Users,
  Flame,
  HandHeart,
  Droplets,
  Sparkles,
  Star,
  Quote,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";
import { Button } from "@/components/ui/button";
import { AstroToolView, ResultHeading } from "./astro-tool-view";

const signs: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: TrendingDown, title: "Career Blockages", desc: "Hard work that never converts into growth, with repeated setbacks." },
  { icon: HeartCrack, title: "Marriage Delays", desc: "Unexplained delays or friction in finding a partner and settling down." },
  { icon: Baby, title: "Childbirth Issues", desc: "Difficulty conceiving or recurring problems related to children." },
  { icon: Home, title: "Family Discord", desc: "Constant tension, misunderstandings and lack of peace at home." },
  { icon: Coins, title: "Financial Instability", desc: "Money that comes but never stays; sudden, unexplained losses." },
  { icon: Users, title: "Ancestral Patterns", desc: "The same struggles repeating across generations of the family." },
];

const testimonials: { name: string; place: string; text: string }[] = [
  {
    name: "Rohan Mehta",
    place: "Pune",
    text: "After years of career setbacks, the Pitra Dosha analysis finally explained the pattern. We did the Shraddh and Narayan Bali puja as guided — within months my work finally started moving.",
  },
  {
    name: "Anjali Verma",
    place: "Delhi",
    text: "We were worried about delays in our daughter's marriage. The astrologer identified Pitra Dosha and suggested simple remedies. The family feels so much lighter now.",
  },
  {
    name: "Suresh Iyer",
    place: "Chennai",
    text: "I was sceptical at first, but the free report was surprisingly accurate about the ancestral issues in our family. The remedies brought real peace at home.",
  },
];

const remedies: { image: string; title: string; desc: string; icon: LucideIcon }[] = [
  {
    image: "https://images.unsplash.com/photo-1604881991720-f91add269bed?auto=format&fit=crop&w=800&q=80",
    title: "Shraddh & Tarpan",
    desc: "Offer water and prayers to ancestors during Pitru Paksha to bring their blessings.",
    icon: Droplets,
  },
  {
    image: "https://images.unsplash.com/photo-1600431521340-491eca880813?auto=format&fit=crop&w=800&q=80",
    title: "Pind Daan",
    desc: "Perform Pind Daan at holy sites like Gaya to release ancestral karma.",
    icon: Flame,
  },
  {
    image: "https://images.unsplash.com/photo-1545986150-9b25a3f6a48f?auto=format&fit=crop&w=800&q=80",
    title: "Narayan Bali Puja",
    desc: "A powerful ritual to pacify unsatisfied ancestral souls and remove the dosha.",
    icon: Sparkles,
  },
  {
    image: "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80",
    title: "Charity & Seva",
    desc: "Feed Brahmins and the needy, and serve elders to balance ancestral debt.",
    icon: HandHeart,
  },
];

export function PitraDoshView() {
  return (
    <AstroToolView
      breadcrumb="Pitra Dosh Calculator"
      badge="Ancestral Karma · Free"
      badgeIcon={Flower2}
      titleTop="Is Pitra Dosha"
      titleAccent="Affecting Your Life?"
      intro="Pitra Dosha, or ancestral karmic debt, can quietly block your progress, wealth, marriage and peace. Enter your birth details to check your Kundali for Pitra Dosha free — and discover the Vedic remedies that bring relief."
      cta="Check Pitra Dosha"
      requireTime
      heroImage="https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=2400&q=80"
      heroStats={[
        { value: "50,000+", label: "Kundlis Checked" },
        { value: "4.9★", label: "Avg. Rating" },
        { value: "25,000+", label: "Consultations" },
      ]}
      renderResult={(d) => {
        const pd = d.doshas.pitraDosh;
        return (
          <div className="mx-auto max-w-2xl">
            <ResultHeading icon={Flower2}>Your Pitra Dosha Report</ResultHeading>
            <p className="-mt-4 mb-8 text-center text-sm text-muted">
              {d.name}, born in {d.place} · Lagna {d.ascendant.rashi} · Moon {d.moonSign.rashi}
            </p>
            <div className={`rounded-[2rem] border p-7 text-center ${pd.present ? "border-amber-400/40 bg-amber-400/5" : "border-emerald-400/30 bg-emerald-400/5"}`}>
              <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${pd.present ? "bg-amber-400/15 text-amber-600" : "bg-emerald-400/15 text-emerald-600"}`}>
                {pd.present ? <AlertTriangle size={26} /> : <Check size={26} />}
              </span>
              <p className={`mt-4 font-display text-2xl font-bold ${pd.present ? "text-amber-700" : "text-emerald-700"}`}>
                {pd.verdict}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{pd.explanation}</p>
            </div>
            <div className="mt-8 rounded-[2rem] bg-gradient-to-br from-royal-500 to-royal-700 p-7 text-center text-white">
              <h3 className="font-display text-xl font-semibold">Need the right remedy?</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
                Pitra Dosha is eased with Shraddh, Tarpan and Pind Daan. Our astrologers will tell you
                exactly which puja suits your chart.
              </p>
              <Link href="/#free-consultation" className="mt-5 inline-block">
                <Button variant="gold" size="lg">Get Free Guidance</Button>
              </Link>
            </div>
          </div>
        );
      }}
    >
      {/* ---- Understanding Pitra Dosha (image + content) ---- */}
      <section className="py-16">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-foreground/10 shadow-[0_30px_80px_-30px_rgba(36,26,59,0.45)]"
            >
              <Image
                src="https://images.unsplash.com/photo-1604881991720-f91add269bed?auto=format&fit=crop&w=1200&q=85"
                alt="Vedic fire ritual to remove Pitra Dosha"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold-500">
                <span className="h-px w-6 bg-gradient-to-r from-transparent to-gold-400" />
                Vedic Wisdom
              </div>
              <h2 className="font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                Understanding Pitra Dosha in <span className="text-gradient-gold">Vedic Astrology</span>
              </h2>
              <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
                <p>
                  Pitra Dosha (also spelled Pitru Dosh) is an astrological condition linked to the
                  unresolved karma of one&apos;s ancestors. In the birth chart it is traditionally seen
                  when the Sun or Moon is afflicted by Rahu or Ketu, or when malefic planets occupy the
                  9th house — the house of the father and forefathers.
                </p>
                <p>
                  Our ancestors&apos; unfulfilled desires and unperformed rites are believed to pass on
                  as a karmic debt, showing up as recurring obstacles in career, marriage, children and
                  family harmony. The good news: Pitra Dosha is not a curse — it is a call to honour your
                  lineage, and it responds well to sincere remedies.
                </p>
              </div>
              <Link href="/#free-consultation" className="mt-6 inline-block">
                <Button variant="gold" size="lg">Talk to an Astrologer</Button>
              </Link>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* ---- Common signs ---- */}
      <section className="bg-void py-16">
        <Container>
          <SectionHeader
            eyebrow="Warning Signs"
            title={<>Common Signs of <span className="text-gradient-gold">Pitra Dosha</span></>}
            description="If several of these patterns repeat in your life despite your best efforts, Pitra Dosha may be at play."
            className="mb-12"
          />
          <StaggerContainer className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.06}>
            {signs.map((s) => (
              <motion.div
                key={s.title}
                variants={staggerItem}
                whileHover={{ y: -5 }}
                className="rounded-3xl border border-foreground/10 bg-nebula p-6 transition-colors hover:border-amber-400/40"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/15 to-rose-mystic/15 text-amber-600">
                  <s.icon size={20} />
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.desc}</p>
              </motion.div>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      {/* ---- Remedies ---- */}
      <section className="py-16">
        <Container>
          <SectionHeader
            eyebrow="The Cure"
            title={<>Recommended Vedic <span className="text-gradient-gold">Remedies &amp; Rituals</span></>}
            description="Time-tested remedies that pacify ancestors and release the karmic debt of Pitra Dosha."
            className="mb-12"
          />
          <StaggerContainer className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" stagger={0.08}>
            {remedies.map((r) => (
              <motion.div key={r.title} variants={staggerItem} whileHover={{ y: -6 }}>
                <div className="group flex h-full flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-nebula transition-all duration-500 hover:border-gold-400/40 hover:shadow-[0_26px_60px_-30px_rgba(122,69,245,0.35)]">
                  <div className="relative aspect-[16/11] overflow-hidden">
                    <Image
                      src={r.image}
                      alt={r.title}
                      fill
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-nebula/90 text-gold-600 backdrop-blur-sm">
                      <r.icon size={16} />
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-base font-semibold text-foreground">{r.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{r.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      {/* ---- Testimonials ---- */}
      <section className="bg-void py-16">
        <Container>
          <SectionHeader
            eyebrow="Real Stories"
            title={<>What Devotees <span className="text-gradient-gold">Experienced</span></>}
            description="Thousands have found clarity and relief after understanding and remedying their Pitra Dosha."
            className="mb-12"
          />
          <StaggerContainer className="grid grid-cols-1 gap-6 md:grid-cols-3" stagger={0.08}>
            {testimonials.map((t) => (
              <motion.div
                key={t.name}
                variants={staggerItem}
                whileHover={{ y: -5 }}
                className="relative flex h-full flex-col rounded-3xl border border-foreground/10 bg-nebula p-6 transition-all duration-500 hover:border-gold-400/40 hover:shadow-[0_26px_60px_-30px_rgba(122,69,245,0.3)]"
              >
                <Quote size={28} className="text-gold-400/40" />
                <div className="mt-2 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} className="fill-gold-500 text-gold-500" />
                  ))}
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3 border-t border-foreground/8 pt-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-sm font-bold text-white">
                    {t.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted">{t.place}, India</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      {/* ---- Closing CTA ---- */}
      <section className="py-10">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-royal-500 to-royal-700 p-8 text-center text-white sm:p-12"
          >
            <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-gold-400/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 right-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <h2 className="font-display text-3xl font-semibold sm:text-4xl">
                Want to Know More About Pitra Dosha?
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-white/80">
                Get a personalised analysis of how Pitra Dosha forms in your chart and the exact
                remedy that will work for you — free with our expert astrologers.
              </p>
              <Link href="/#free-consultation" className="mt-7 inline-block">
                <Button variant="gold" size="lg">Book Free Consultation</Button>
              </Link>
            </div>
          </motion.div>
        </Container>
      </section>
    </AstroToolView>
  );
}
