"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CalendarDays, Hand, Gem, Clock, ScrollText } from "lucide-react";
import type { Product } from "@/types";
import { cn } from "@/lib/utils";
import { getWearingGuide } from "@/data/wearing";

type TabKey = "description" | "benefits" | "wear" | "certification";

const tabs: { key: TabKey; label: string }[] = [
  { key: "description", label: "Description" },
  { key: "benefits", label: "Benefits" },
  { key: "wear", label: "How to Wear" },
  { key: "certification", label: "Certification" },
];

export function ProductTabs({ product }: { product: Product }) {
  const [tab, setTab] = useState<TabKey>("description");
  const guide = getWearingGuide(product.attributes.planet);

  return (
    <section className="mt-16">
      {/* tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-foreground/10">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "relative shrink-0 px-4 py-3 text-sm font-medium transition-colors sm:px-6",
              tab === t.key ? "text-gold-600" : "text-muted hover:text-foreground"
            )}
          >
            {t.label}
            {tab === t.key && (
              <motion.span
                layoutId="product-tab-underline"
                className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-gold-400 to-gold-500"
              />
            )}
          </button>
        ))}
      </div>

      {/* panels */}
      <div className="py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {tab === "description" && (
              <div className="max-w-3xl space-y-4 text-base leading-relaxed text-muted">
                <p>
                  {product.shortDescription} This {product.attributes.stone} is a
                  100% natural, {product.attributes.certification.toLowerCase()}{" "}
                  gemstone sourced from {product.attributes.origin}.
                </p>
                <p>
                  Ruled by {product.attributes.planet}, it is traditionally worn
                  to invite {product.attributes.benefits.join(", ").toLowerCase()}.
                  Each stone is hand-inspected by our gemologists and energised by
                  Vedic pandits before dispatch, so you receive a gem that is both
                  authentic and spiritually activated.
                </p>
              </div>
            )}

            {tab === "benefits" && (
              <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
                {product.attributes.benefits.map((b) => (
                  <div
                    key={b}
                    className="flex items-start gap-3 rounded-2xl border border-foreground/10 bg-nebula p-4"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400/20 to-royal-400/15 text-gold-600">
                      <Sparkles size={16} />
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{b}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        Associated with the energy of {product.attributes.planet}.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "wear" && (
              <div className="max-w-3xl">
                <p className="mb-5 text-sm text-muted">
                  Traditional guidance for wearing {product.attributes.stone}. For
                  best results, consult an astrologer for your specific chart.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <WearItem icon={CalendarDays} label="Best Day" value={guide.day} />
                  <WearItem icon={Hand} label="Finger" value={guide.finger} />
                  <WearItem icon={Gem} label="Metal" value={guide.metal} />
                  <WearItem icon={Clock} label="Time" value={guide.time} />
                </div>
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-gold-400/25 bg-gold-400/5 p-5">
                  <ScrollText size={18} className="mt-0.5 shrink-0 text-gold-600" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Mantra</p>
                    <p className="mt-1 text-sm italic text-muted">
                      “{guide.mantra}” — chant 108 times while wearing.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {tab === "certification" && (
              <div className="max-w-3xl space-y-4 text-base leading-relaxed text-muted">
                <p>
                  This gemstone is certified by{" "}
                  <span className="font-semibold text-foreground">
                    {product.attributes.certification}
                  </span>
                  , a globally recognised gemological authority. The certificate
                  confirms the stone&apos;s natural origin, weight (
                  {product.attributes.weightCarat} carat), colour and treatment
                  status.
                </p>
                <ul className="space-y-2">
                  {[
                    "Verifiable certificate number",
                    "Natural & untreated confirmation",
                    "Carat weight & measurements",
                    "Origin & colour grading",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function WearItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-nebula p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600">
        <Icon size={18} />
      </span>
      <div>
        <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
        <p className="font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
