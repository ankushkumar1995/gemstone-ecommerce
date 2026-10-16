"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  MessageCircle,
  AtSign,
  Share2,
  Globe,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Dropdown } from "@/components/ui/dropdown";
import { api } from "@/lib/api-client";
import { useToast } from "@/lib/toast";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";
import { cn } from "@/lib/utils";

const socials = [
  { icon: AtSign, href: "#", label: "Instagram" },
  { icon: Share2, href: "#", label: "Facebook" },
  { icon: Globe, href: "#", label: "Website" },
];

const subjects = [
  "Gemstone Guidance",
  "Order / Delivery Help",
  "Free Astrology Consultation",
  "Return / Buyback",
  "Other",
];

export function ContactView() {
  const store = useStoreSettings();
  const contactCards = [
    {
      icon: Phone,
      label: "Call Us",
      value: store.supportPhone,
      href: `tel:+${phoneDigits(store.supportPhone)}`,
      sub: "Mon–Sat, 10am – 7pm",
    },
    {
      icon: Mail,
      label: "Email Us",
      value: store.supportEmail,
      href: `mailto:${store.supportEmail}`,
      sub: "We reply within 24 hours",
    },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: store.whatsappNumber,
      href: `https://wa.me/${phoneDigits(store.whatsappNumber)}`,
      sub: "Quick order & stone help",
    },
  ];

  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subject, setSubject] = useState(subjects[0]);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<
      string,
      string
    >;

    setSubmitting(true);
    const res = await api.leads.create({
      source: "contact",
      name: data.name,
      email: data.email,
      phone: data.phone,
      topic: subject,
      message: data.message,
    });
    setSubmitting(false);

    if (res.ok) {
      setSent(true);
      form.reset();
    } else {
      toast(res.message, "error");
    }
  };

  return (
    <div className="pb-20">
      <Container className="pt-6">
        <Breadcrumb items={[{ label: "Contact" }]} />
      </Container>

      {/* ---- Header ---- */}
      <section className="relative overflow-hidden py-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(230,180,58,0.18), transparent 70%)",
          }}
        />
        <Container className="relative text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gold-500">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-gold-400" />
              We&apos;re Here to Help
              <span className="h-px w-6 bg-gradient-to-l from-transparent to-gold-400" />
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
              Get in <span className="text-gradient-gold">Touch</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
              Questions about a stone, your order or your birth chart? Our
              gemstone experts and astrologers are a message away.
            </p>
          </motion.div>
        </Container>
      </section>

      <Container>
        {/* ---- Contact cards ---- */}
        <div className="grid gap-5 sm:grid-cols-3">
          {contactCards.map((c, i) => (
            <motion.a
              key={c.label}
              href={c.href}
              target={c.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="group flex items-start gap-4 rounded-3xl border border-foreground/10 bg-nebula p-6 transition-all duration-300 hover:border-gold-400/40 hover:shadow-[0_20px_50px_-28px_rgba(36,26,59,0.45)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-500 text-white transition-transform group-hover:scale-110">
                <c.icon size={20} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {c.label}
                </p>
                <p className="mt-0.5 font-semibold text-foreground">{c.value}</p>
                <p className="mt-0.5 text-xs text-muted">{c.sub}</p>
              </div>
            </motion.a>
          ))}
        </div>

        {/* ---- Form + info ---- */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
            className="rounded-[2rem] border border-foreground/10 bg-nebula p-6 shadow-[0_20px_50px_-30px_rgba(36,26,59,0.4)] sm:p-8"
          >
            {sent ? (
              <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white">
                  <CheckCircle2 size={30} />
                </span>
                <h3 className="mt-5 text-2xl font-semibold text-foreground">
                  Message Sent!
                </h3>
                <p className="mt-2 max-w-sm text-muted">
                  Thank you for reaching out. Our team will get back to you
                  within 24 hours.
                </p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-6 text-sm font-semibold text-gold-600 hover:text-gold-500"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-semibold text-foreground">
                  Send Us a Message
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Fill in the form and we&apos;ll be in touch shortly.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Full Name" htmlFor="name">
                      <input
                        id="name"
                        name="name"
                        required
                        type="text"
                        placeholder="Your name"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Phone" htmlFor="phone">
                      <input
                        id="phone"
                        name="phone"
                        required
                        type="tel"
                        placeholder="+91 00000 00000"
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <Field label="Email" htmlFor="email">
                    <input
                      id="email"
                      name="email"
                      required
                      type="email"
                      placeholder="you@example.com"
                      className={inputClass}
                    />
                  </Field>

                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-foreground">
                      Subject
                    </span>
                    <Dropdown
                      value={subject}
                      onChange={setSubject}
                      align="left"
                      className="w-full"
                      options={subjects.map((s) => ({ value: s, label: s }))}
                    />
                  </div>

                  <Field label="Message" htmlFor="message">
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={5}
                      placeholder="Tell us how we can help…"
                      className={cn(inputClass, "resize-none")}
                    />
                  </Field>

                  <Button
                    type="submit"
                    variant="gold"
                    size="lg"
                    disabled={submitting}
                    className="w-full sm:w-auto"
                  >
                    <Send size={16} /> {submitting ? "Sending…" : "Send Message"}
                  </Button>
                </form>
              </>
            )}
          </motion.div>

          {/* Info / hours / map */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            {/* Address + hours */}
            <div className="rounded-[2rem] border border-foreground/10 bg-nebula p-6 shadow-[0_20px_50px_-30px_rgba(36,26,59,0.4)]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600">
                  <MapPin size={18} />
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">Visit Our Store</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {store.address}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-start gap-3 border-t border-foreground/8 pt-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600">
                  <Clock size={18} />
                </span>
                <div>
                  <h3 className="font-semibold text-foreground">Working Hours</h3>
                  <p className="mt-1 text-sm text-muted">Mon – Sat: 10:00 am – 7:00 pm</p>
                  <p className="text-sm text-muted">Sunday: Closed</p>
                </div>
              </div>

              <div className="mt-6 border-t border-foreground/8 pt-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Follow Us
                </p>
                <div className="mt-3 flex gap-2.5">
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      aria-label={s.label}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10 text-muted transition-colors hover:border-gold-400/50 hover:bg-gold-400/10 hover:text-gold-600"
                    >
                      <s.icon size={17} />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="overflow-hidden rounded-[2rem] border border-foreground/10 shadow-[0_20px_50px_-30px_rgba(36,26,59,0.4)]">
              <iframe
                title="Astrounkle store location"
                src="https://www.google.com/maps?q=Jaipur,Rajasthan&output=embed"
                className="h-56 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </motion.div>
        </div>
      </Container>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
