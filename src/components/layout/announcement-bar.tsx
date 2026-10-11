"use client";

import { motion } from "framer-motion";
import { Sparkles, Truck, ShieldCheck } from "lucide-react";

const messages = [
  { icon: ShieldCheck, text: "100% Certified Natural Gemstones" },
  { icon: Truck, text: "Free Insured Shipping across India" },
  { icon: Sparkles, text: "Complimentary Astrology Consultation" },
];

export function AnnouncementBar() {
  return (
    <div className="relative z-50 overflow-hidden bg-gradient-to-r from-royal-700 via-royal-600 to-royal-700">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-8 px-5 py-2 text-xs text-royal-50 sm:px-8">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            className="flex items-center gap-1.5 whitespace-nowrap"
          >
            <m.icon size={13} className="text-gold-300" />
            <span className={i === 0 ? "" : "hidden sm:inline"}>{m.text}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
