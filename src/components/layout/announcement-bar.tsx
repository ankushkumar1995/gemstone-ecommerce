"use client";

import { motion } from "framer-motion";
import { Sparkles, Truck, ShieldCheck, Phone, Mail, MapPin } from "lucide-react";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";

const messages = [
  { icon: ShieldCheck, text: "100% Certified Natural Gemstones" },
  { icon: Truck, text: "Free Insured Shipping across India" },
  { icon: Sparkles, text: "Complimentary Astrology Consultation" },
];

export function AnnouncementBar() {
  const store = useStoreSettings();

  const contact = [
    {
      icon: Phone,
      text: store.supportPhone,
      href: `tel:+${phoneDigits(store.supportPhone)}`,
    },
    {
      icon: Mail,
      text: store.supportEmail,
      href: `mailto:${store.supportEmail}`,
    },
    {
      icon: MapPin,
      text: store.address,
      href: undefined,
    },
  ];

  return (
    <div className="relative z-50 overflow-hidden bg-gradient-to-r from-royal-700 via-royal-600 to-royal-700">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-2 text-xs text-royal-50 sm:px-8">
        {/* ---- Left: contact info ---- */}
        <div className="flex items-center gap-4 sm:gap-5">
          {contact.map((c, i) => {
            const content = (
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <c.icon size={13} className="text-gold-300" />
                {/* phone always visible; email from sm; address from lg */}
                <span
                  className={
                    i === 0 ? "" : i === 1 ? "hidden sm:inline" : "hidden lg:inline"
                  }
                >
                  {c.text}
                </span>
              </span>
            );

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                {c.href ? (
                  <a
                    href={c.href}
                    className="transition-colors hover:text-gold-200"
                  >
                    {content}
                  </a>
                ) : (
                  content
                )}
              </motion.div>
            );
          })}
        </div>

        {/* ---- Right: trust messages ---- */}
        <div className="flex items-center gap-5 sm:gap-8">
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-1.5 whitespace-nowrap"
            >
              <m.icon size={13} className="text-gold-300" />
              <span className={i === 2 ? "" : "hidden md:inline"}>{m.text}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
