"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, HelpCircle } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { gemstoneFaqs } from "@/data/faqs";
import { cn } from "@/lib/utils";

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
          {gemstoneFaqs.map((f, i) => {
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
