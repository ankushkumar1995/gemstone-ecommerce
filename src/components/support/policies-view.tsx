"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, RefreshCw, Lock, FileText } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

type Section = {
  key: string;
  label: string;
  icon: React.ElementType;
  body: { heading: string; text: string }[];
};

const sections: Section[] = [
  {
    key: "shipping",
    label: "Shipping",
    icon: Truck,
    body: [
      {
        heading: "Processing time",
        text: "Orders are certified and energised, then dispatched within 2–4 business days.",
      },
      {
        heading: "Delivery time",
        text: "Fully insured, tracked delivery across India in 3–7 business days.",
      },
      {
        heading: "Shipping charges",
        text: "Free insured shipping on orders above ₹5,000. A ₹199 insured-shipping fee applies to smaller orders.",
      },
    ],
  },
  {
    key: "returns",
    label: "Returns & Buyback",
    icon: RefreshCw,
    body: [
      {
        heading: "7-day returns",
        text: "Unused certified stones in original condition with the certificate can be returned within 7 days of delivery.",
      },
      {
        heading: "Refunds",
        text: "Approved refunds are processed to the original payment method within 5–7 business days.",
      },
      {
        heading: "Lifetime buyback",
        text: "We buy back certified gemstones at prevailing market value, subject to inspection.",
      },
    ],
  },
  {
    key: "privacy",
    label: "Privacy",
    icon: Lock,
    body: [
      {
        heading: "What we collect",
        text: "Only the information needed to process your order and provide astrology guidance — name, contact and shipping details.",
      },
      {
        heading: "How we use it",
        text: "To fulfil orders, offer support and (with consent) share relevant offers. We never sell your data.",
      },
      {
        heading: "Security",
        text: "Payments are processed over encrypted, PCI-compliant gateways. Your details stay protected.",
      },
    ],
  },
  {
    key: "terms",
    label: "Terms",
    icon: FileText,
    body: [
      {
        heading: "Astrological guidance",
        text: "Gemstone recommendations are based on traditional Vedic astrology and are for guidance; results may vary by individual.",
      },
      {
        heading: "Pricing & availability",
        text: "Prices and stock are subject to change. Rare stones are sold on a first-come basis.",
      },
      {
        heading: "Acceptance",
        text: "By placing an order you agree to these terms and our privacy policy.",
      },
    ],
  },
];

export function PoliciesView() {
  const [active, setActive] = useState(sections[0].key);
  const current = sections.find((s) => s.key === active)!;

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumb items={[{ label: "Policies" }]} className="mb-8" />
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Our <span className="text-gradient-gold">Policies</span>
          </h1>
          <p className="mt-2 text-muted">
            Clear, fair terms so you can shop with complete peace of mind.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-[14rem_1fr]">
          {/* side tabs */}
          <div className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors md:w-full",
                  active === s.key
                    ? "border-gold-400/50 bg-gold-400/10 text-gold-600"
                    : "border-foreground/10 bg-nebula text-muted hover:text-foreground"
                )}
              >
                <s.icon size={17} />
                {s.label}
              </button>
            ))}
          </div>

          {/* content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="rounded-[2rem] border border-foreground/10 bg-nebula p-6 sm:p-8"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600">
                  <current.icon size={20} />
                </span>
                <h2 className="text-xl font-semibold text-foreground">
                  {current.label} Policy
                </h2>
              </div>

              <div className="mt-6 space-y-5">
                {current.body.map((b) => (
                  <div key={b.heading}>
                    <h3 className="text-sm font-semibold text-foreground">
                      {b.heading}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {b.text}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Container>
  );
}
