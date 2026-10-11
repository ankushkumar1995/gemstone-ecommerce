"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Gem, Sparkles, Truck } from "lucide-react";
import { Container } from "@/components/ui/container";

const features = [
  {
    icon: ShieldCheck,
    title: "Lab Certified",
    desc: "Every stone comes with IGI / GIA certification you can verify.",
  },
  {
    icon: Gem,
    title: "100% Natural",
    desc: "Ethically sourced, untreated natural gemstones only.",
  },
  {
    icon: Sparkles,
    title: "Astrology Guidance",
    desc: "Free consultation to match the right stone to you.",
  },
  {
    icon: Truck,
    title: "Insured Delivery",
    desc: "Fully insured, secure shipping across India.",
  },
];

export function TrustBand() {
  return (
    <section className="py-10">
      <Container className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            whileHover={{ y: -4 }}
            className="group flex items-start gap-4 rounded-2xl glass p-5 transition-colors hover:border-gold-400/30"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/20 to-gold-400/25 text-gold-600 transition-transform group-hover:scale-110">
              <f.icon size={20} />
            </span>
            <div>
              <h4 className="font-semibold text-foreground">{f.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-muted">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </Container>
    </section>
  );
}
