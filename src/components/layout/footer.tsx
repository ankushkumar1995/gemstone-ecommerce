"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Gem,
  Send,
  AtSign,
  Share2,
  ShieldCheck,
  Truck,
  Mail,
  Phone,
  MapPin,
  Sparkles,
} from "lucide-react";
import { useStoreSettings, phoneDigits } from "@/lib/store-settings";

const columns = [
  {
    title: "Shop",
    links: [
      { label: "Gemstone Rings", href: "/shop?category=rings" },
      { label: "Pendants", href: "/shop?category=pendants" },
      { label: "Bracelets", href: "/shop?category=bracelets" },
      { label: "Loose Stones", href: "/shop?category=loose-stones" },
      { label: "Rudraksha", href: "/shop?category=rudraksha" },
    ],
  },
  {
    title: "Astrology",
    links: [
      { label: "All Services", href: "/services" },
      { label: "Find Your Stone", href: "/#zodiac" },
      { label: "Free Consultation", href: "/services" },
      { label: "About Us", href: "/#about" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Track Order", href: "/track-order" },
      { label: "Shipping & Returns", href: "/policies" },
      { label: "Contact Us", href: "/contact" },
      { label: "FAQs", href: "/faq" },
    ],
  },
];

const trustBadges = [
  { icon: ShieldCheck, label: "IGI / GIA Certified" },
  { icon: Truck, label: "Free Insured Shipping" },
  { icon: Sparkles, label: "Astrology Guidance" },
];

export function Footer() {
  const store = useStoreSettings();
  const contact = [
    { icon: Mail, label: store.supportEmail, href: `mailto:${store.supportEmail}` },
    { icon: Phone, label: store.supportPhone, href: `tel:+${phoneDigits(store.supportPhone)}` },
    { icon: MapPin, label: store.address, href: "#" },
  ];
  return (
    <footer className="relative mt-10 overflow-hidden bg-gradient-to-b from-[#1a1340] via-[#120d2e] to-[#0b0820] text-white">
      {/* decorative glows */}
      <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-royal-600/30 blur-[110px]" />
      <div className="pointer-events-none absolute -right-16 top-20 h-80 w-80 rounded-full bg-gold-500/15 blur-[120px]" />
      {/* gold top hairline */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        {/* ---------------- MAIN GRID ---------------- */}
        <div className="grid gap-10 pb-12 pt-14 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          {/* Brand */}
          <div>
            <Link href="/" className="group flex items-center gap-2">
              <motion.span
                whileHover={{ rotate: 20, scale: 1.1 }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-royal-600 text-white shadow-lg"
              >
                <Gem size={20} />
              </motion.span>
              <span className="font-display text-2xl font-semibold text-gradient-gold">
                {store.storeName}
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
              Certified natural gemstones curated by the stars. Luxury jewellery
              crafted with authenticity and astrological wisdom.
            </p>

            {/* contact */}
            <div className="mt-6 space-y-3">
              {contact.map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  className="flex items-center gap-3 text-sm text-white/70 transition-colors hover:text-gold-300"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gold-300">
                    <c.icon size={14} />
                  </span>
                  {c.label}
                </a>
              ))}
            </div>

            {/* socials */}
            <div className="mt-6 flex gap-3">
              {[Send, AtSign, Share2].map((Icon, i) => (
                <motion.a
                  key={i}
                  href="#"
                  aria-label="social"
                  whileHover={{ y: -3 }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-gold-400/50 hover:text-gold-300"
                >
                  <Icon size={16} />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-5 text-sm font-semibold uppercase tracking-wider text-white">
                {col.title}
              </h4>
              <ul className="space-y-3.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-gold-300"
                    >
                      <span className="h-px w-0 bg-gold-400 transition-all duration-300 group-hover:w-4" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ---------------- TRUST STRIP ---------------- */}
        <div className="grid gap-4 border-t border-white/10 py-8 sm:grid-cols-3">
          {trustBadges.map((b) => (
            <div
              key={b.label}
              className="flex items-center justify-center gap-2.5 text-sm text-white/70"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-royal-500/40 to-gold-400/20 text-gold-300">
                <b.icon size={16} />
              </span>
              {b.label}
            </div>
          ))}
        </div>

        {/* ---------------- BOTTOM BAR ---------------- */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 py-7 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} {store.storeName} Gems. Crafted with devotion in India.</p>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <Link href="#" className="transition-colors hover:text-gold-300">Privacy Policy</Link>
            <Link href="#" className="transition-colors hover:text-gold-300">Terms</Link>
            <Link href="#" className="transition-colors hover:text-gold-300">Refund Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
