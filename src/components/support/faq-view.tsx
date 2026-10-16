"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, HelpCircle } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Are your gemstones natural and certified?",
    a: "Yes. Every gemstone we sell is 100% natural and untreated unless explicitly stated. Each stone ships with a certificate from a recognised lab such as IGI, GIA or GII, which you can independently verify online.",
  },
  {
    q: "How do I know which gemstone is right for me?",
    a: "You can shop by your zodiac sign or ruling planet, or book a free consultation with our in-house Vedic astrologers. They assess your birth chart and recommend the most suitable stone and carat weight.",
  },
  {
    q: "What is gemstone energisation (prana pratishtha)?",
    a: "Before dispatch, learned pandits perform a traditional abhimantran ritual to activate the gemstone's astrological energy. This complimentary service is included with every order.",
  },
  {
    q: "What is your return and buyback policy?",
    a: "We offer a 7-day easy return on unused, certified stones in original condition. We also provide lifetime buyback on certified gemstones at prevailing market value.",
  },
  {
    q: "How long does delivery take?",
    a: "Orders are dispatched within 2–4 business days after certification and energisation. Delivery across India typically takes 3–7 business days with fully insured, tracked shipping.",
  },
  {
    q: "Is shipping free?",
    a: "Shipping is free and fully insured on all orders above ₹5,000. For orders below that, a nominal insured-shipping fee of ₹199 applies.",
  },
  {
    q: "Can I wear any gemstone without consultation?",
    a: "Certain powerful stones (like Blue Sapphire / Neelam) are best worn after astrological guidance. We strongly recommend a quick free consultation before purchasing high-impact stones.",
  },
];

export function FaqView() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumb items={[{ label: "FAQs" }]} className="mb-8" />
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-500 text-white">
            <HelpCircle size={26} />
          </span>
          <h1 className="mt-5 text-3xl font-semibold text-foreground sm:text-4xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-2 text-muted">
            Everything you need to know about buying gemstones from Astrounkle.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={f.q}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-nebula transition-colors",
                  isOpen ? "border-gold-400/40" : "border-foreground/10"
                )}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-foreground">{f.q}</span>
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                      isOpen
                        ? "rotate-45 bg-gold-400 text-white"
                        : "bg-foreground/5 text-muted"
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
                      <p className="px-5 pb-5 text-sm leading-relaxed text-muted">
                        {f.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* still need help */}
        <div className="mt-12 rounded-[2rem] border border-foreground/10 bg-gradient-to-br from-royal-500 to-royal-700 p-8 text-center text-white">
          <h2 className="text-2xl font-semibold">Still have questions?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
            Our gemstone experts are happy to help you choose with confidence.
          </p>
          <Link href="/contact" className="mt-6 inline-block">
            <Button variant="gold" size="lg">
              Contact Us
            </Button>
          </Link>
        </div>
      </div>
    </Container>
  );
}
