"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircleQuestion,
  Sparkles,
  CheckCircle2,
  Loader2,
  Plus,
  ShieldCheck,
  Clock,
  Star,
  Wallet,
  PencilLine,
  Send,
  UserCheck,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/lib/toast";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SectionHeader } from "@/components/ui/section-header";
import { StaggerContainer, staggerItem } from "@/components/ui/reveal";
import { askAstrologerFaqs } from "@/data/faqs";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

/* ---------------- content data ---------------- */

interface QPackage {
  questions: number;
  title: string;
  priceInr: number;
  blurb: string;
  popular?: boolean;
}

const packages: QPackage[] = [
  {
    questions: 1,
    title: "One Question",
    priceInr: 299,
    blurb: "Perfect for a single, focused concern you need clarity on right now.",
  },
  {
    questions: 2,
    title: "Two Questions",
    priceInr: 499,
    blurb: "Ideal when two areas of life need answers — career and relationship, maybe.",
    popular: true,
  },
  {
    questions: 3,
    title: "Three Questions",
    priceInr: 699,
    blurb: "Best value — a deeper look across multiple areas of your life.",
  },
];

const steps = [
  {
    icon: PencilLine,
    title: "Submit Your Question",
    desc: "Share your question and birth details through a simple form.",
  },
  {
    icon: Send,
    title: "Expert Analysis",
    desc: "A certified Vedic astrologer studies your chart in depth.",
  },
  {
    icon: UserCheck,
    title: "Get a Written Answer",
    desc: "Receive a clear, personalised written reply within 24 hours.",
  },
];

const reasons = [
  { icon: UserCheck, title: "Guided by Senior Astrologers", desc: "Learned pandits with 15+ years of Jyotish experience." },
  { icon: Clock, title: "Answered within 24 Hours", desc: "No long waits — fast, thoughtful replies." },
  { icon: PencilLine, title: "Clear, Actionable Remedies", desc: "Practical guidance you can actually follow." },
  { icon: ShieldCheck, title: "100% Private & Confidential", desc: "Your details stay safe and are never shared." },
  { icon: Wallet, title: "Affordable, Transparent Pricing", desc: "Honest prices with no hidden charges." },
];

/* ---------------- component ---------------- */

export function AskAstrologerView() {
  const { format } = useCurrency();
  const { toast } = useToast();

  const [selected, setSelected] = useState(1); // index of chosen package
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError("");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;

    if (!data.name?.trim() || !data.phone?.trim() || !data.question?.trim()) {
      setError("Please enter your name, phone and your question.");
      return;
    }

    const pack = packages[selected];
    setSubmitting(true);
    const res = await api.leads.create({
      source: "service",
      name: data.name,
      email: data.email || "",
      phone: data.phone,
      topic: `Ask the Astrologer — ${pack.title} (${format(pack.priceInr)})`,
      message: data.question,
      birth: { date: data.dob, time: data.birthTime, place: data.birthPlace },
    });
    setSubmitting(false);

    if (res.ok) {
      setSent(true);
      form.reset();
      toast("Question submitted! We'll reply within 24 hours.", "success");
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="pb-6">
      <Container className="pt-6">
        <Breadcrumb items={[{ label: "Ask the Astrologer" }]} />
      </Container>

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden py-14 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(145,105,255,0.18), transparent 70%)" }}
        />
        <Container className="relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
              <MessageCircleQuestion size={14} />
              Ask the Astrologer
            </span>
            <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
              One Clear Answer —{" "}
              <span className="text-gradient-gold">From a Real Astrologer</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted">
              No bots, no vague predictions. Submit your question and get a
              thoughtful, personalised written answer from a certified Vedic
              astrologer — straight to your phone.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href="#ask-form">
                <Button variant="gold" size="lg">
                  Ask Your Question <ArrowRight size={16} />
                </Button>
              </a>
            </div>
          </motion.div>
        </Container>
      </section>

      {/* ---- Packages ---- */}
      <Container className="py-10">
        <SectionHeader
          eyebrow="Simple Pricing"
          title={<>Choose Your <span className="text-gradient-gold">Question Pack</span></>}
          description="Pick how many questions you'd like answered. The more you ask, the better the value."
          className="mb-12"
        />
        <StaggerContainer className="grid grid-cols-1 gap-6 md:grid-cols-3" stagger={0.08}>
          {packages.map((p, i) => {
            const active = selected === i;
            return (
              <motion.button
                type="button"
                key={p.title}
                variants={staggerItem}
                whileHover={{ y: -6 }}
                onClick={() => {
                  setSelected(i);
                  document.getElementById("ask-form")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-3xl border bg-nebula p-7 text-left transition-all duration-500",
                  active
                    ? "border-gold-400/60 shadow-[0_26px_60px_-28px_rgba(201,148,42,0.5)]"
                    : "border-foreground/10 hover:border-gold-400/30 hover:shadow-[0_26px_60px_-28px_rgba(122,69,245,0.35)]"
                )}
              >
                {p.popular && (
                  <span className="absolute right-5 top-5 flex items-center gap-1 rounded-full bg-gold-400/15 px-2.5 py-1 text-[11px] font-semibold text-gold-600">
                    <Star size={11} className="fill-gold-500 text-gold-500" />
                    Best Value
                  </span>
                )}
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600 transition-transform duration-500 group-hover:scale-110">
                  <span className="font-display text-2xl font-bold">{p.questions}</span>
                </span>
                <h3 className="mt-5 text-xl font-semibold text-foreground">{p.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{p.blurb}</p>
                <div className="mt-5 flex items-end justify-between border-t border-foreground/8 pt-5">
                  <div>
                    <p className="text-xs text-muted">Price</p>
                    <p className="text-2xl font-bold text-foreground">{format(p.priceInr)}</p>
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                      active
                        ? "bg-gold-400 text-white"
                        : "bg-foreground/5 text-foreground group-hover:bg-gold-400 group-hover:text-white"
                    )}
                  >
                    {active ? "Selected" : "Select"}
                    {active ? <CheckCircle2 size={15} /> : <ArrowRight size={15} />}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </StaggerContainer>
      </Container>

      {/* ---- How it works ---- */}
      <section className="bg-void py-20">
        <Container>
          <SectionHeader
            eyebrow="Simple Process"
            title={<>How It <span className="text-gradient-gold">Works</span></>}
            description="From your question to a clear answer — in three easy steps."
          />
          <StaggerContainer className="relative mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3" stagger={0.12}>
            <div
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent sm:block"
            />
            {steps.map((s, i) => (
              <motion.div key={s.title} variants={staggerItem} className="relative flex flex-col items-center text-center">
                <div className="relative">
                  <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500 to-royal-700 text-white shadow-[0_12px_30px_-10px_rgba(122,69,245,0.5)]">
                    <s.icon size={22} />
                  </span>
                  <span className="absolute -right-2 -top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-gold-400 to-gold-500 text-[11px] font-bold text-white shadow">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-muted">{s.desc}</p>
              </motion.div>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      {/* ---- Ask form ---- */}
      <section id="ask-form" className="scroll-mt-24 py-20">
        <Container>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* Why choose us */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
            >
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold-500">
                <span className="h-px w-6 bg-gradient-to-r from-transparent to-gold-400" />
                Why Choose Us
              </div>
              <h2 className="font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                Real Guidance You Can <span className="text-gradient-gold">Trust</span>
              </h2>
              <ul className="mt-7 space-y-4">
                {reasons.map((r) => (
                  <li key={r.title} className="flex gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600">
                      <r.icon size={18} />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted">{r.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative overflow-hidden rounded-[2rem] border border-gold-400/25 bg-gradient-to-br from-gold-400/[0.06] to-nebula p-6 sm:p-8"
            >
              <AnimatePresence mode="wait">
                {sent ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex min-h-[28rem] flex-col items-center justify-center text-center"
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-[0_18px_40px_-16px_rgba(201,148,42,0.7)]"
                    >
                      <CheckCircle2 size={38} />
                    </motion.span>
                    <h3 className="mt-6 font-display text-2xl font-semibold text-foreground">Question Submitted!</h3>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
                      Our astrologer will study your chart and send a personalised
                      written answer within 24 hours. Keep an eye on your WhatsApp.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSent(false)}
                      className="mt-6 text-sm font-semibold text-gold-600 underline-offset-4 hover:underline"
                    >
                      Ask another question
                    </button>
                  </motion.div>
                ) : (
                  <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleSubmit}>
                    <div className="flex items-center gap-2">
                      <Sparkles size={18} className="text-gold-500" />
                      <h3 className="text-xl font-semibold text-foreground">Ask Your Question</h3>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      Selected: <span className="font-semibold text-gold-600">{packages[selected].title}</span> ·{" "}
                      {format(packages[selected].priceInr)}
                    </p>

                    <div className="mt-6 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Labeled label="Full Name" required>
                          <input name="name" className={inputClass} placeholder="Your name" />
                        </Labeled>
                        <Labeled label="Phone / WhatsApp" required>
                          <input name="phone" className={inputClass} placeholder="+91 00000 00000" />
                        </Labeled>
                        <Labeled label="Email (optional)">
                          <input name="email" type="email" className={inputClass} placeholder="you@email.com" />
                        </Labeled>
                        <Labeled label="Date of Birth">
                          <input name="dob" type="date" className={inputClass} />
                        </Labeled>
                        <Labeled label="Time of Birth">
                          <input name="birthTime" type="time" className={inputClass} />
                        </Labeled>
                        <Labeled label="Place of Birth">
                          <input name="birthPlace" className={inputClass} placeholder="City, Country" />
                        </Labeled>
                      </div>

                      <Labeled label="Your Question" required>
                        <textarea
                          name="question"
                          rows={4}
                          className={cn(inputClass, "resize-none")}
                          placeholder="Ask about career, marriage, health, finance…"
                        />
                      </Labeled>

                      {error && (
                        <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 pt-1">
                        <Button type="submit" variant="gold" size="lg" disabled={submitting}>
                          {submitting ? (
                            <>
                              <Loader2 size={16} className="animate-spin" /> Submitting…
                            </>
                          ) : (
                            <>
                              Submit Question · {format(packages[selected].priceInr)}
                            </>
                          )}
                        </Button>
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          <ShieldCheck size={13} className="text-gold-500" /> Private & confidential
                        </span>
                      </div>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </Container>
      </section>

      {/* ---- FAQ ---- */}
      <section className="py-20">
        <Container>
          <SectionHeader
            eyebrow="Good to Know"
            title={<>Frequently Asked <span className="text-gradient-gold">Questions</span></>}
            className="mb-12"
          />
          <div className="mx-auto max-w-3xl space-y-3">
            {askAstrologerFaqs.map((f, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={f.q}
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-nebula transition-colors",
                    isOpen ? "border-gold-400/40" : "border-foreground/10"
                  )}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="font-medium text-foreground">{f.q}</span>
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                        isOpen ? "rotate-45 bg-gold-400 text-white" : "bg-foreground/5 text-muted"
                      )}
                    >
                      <Plus size={16} />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </Container>
      </section>
    </div>
  );
}

function Labeled({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-rose-mystic"> *</span>}
      </span>
      {children}
    </label>
  );
}
