"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setDone(true);
  }

  return (
    <section className="py-20">
      <Container>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-foreground/10 p-10 text-center shadow-[0_30px_80px_-40px_rgba(122,69,245,0.4)] sm:p-16"
      >
        {/* backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-twilight via-nebula to-gold-200/40" />
        <motion.div
          className="pointer-events-none absolute -left-10 top-0 h-56 w-56 rounded-full bg-royal-500/30 blur-3xl"
          animate={{ x: [0, 40, 0], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 9, repeat: Infinity }}
        />
        <motion.div
          className="pointer-events-none absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-gold-500/20 blur-3xl"
          animate={{ x: [0, -40, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 11, repeat: Infinity }}
        />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/15 px-4 py-1.5 text-xs font-medium text-gold-600">
            <Sparkles size={14} /> Join the inner circle
          </span>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            Unlock <span className="text-gradient-gold">10% Off</span> Your
            First Gemstone
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Subscribe for astrology insights, new arrivals and members-only
            offers. No spam, only cosmic good vibes.
          </p>

          {done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-6 py-3 text-sm font-medium text-emerald-300"
            >
              <Check size={18} /> You&apos;re in! Check your inbox for your code.
            </motion.div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 rounded-full border border-foreground/15 bg-nebula px-5 py-3.5 text-sm text-foreground placeholder:text-muted/70 outline-none transition-colors focus:border-gold-400/70"
              />
              <Button type="submit" variant="gold" size="lg">
                Subscribe
              </Button>
            </form>
          )}
        </div>
      </motion.div>
      </Container>
    </section>
  );
}
