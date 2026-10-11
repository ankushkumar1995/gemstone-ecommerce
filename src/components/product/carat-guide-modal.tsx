"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Ruler, Scale, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Educational "Carat & Size Guide" modal for gemstones. Covers carat↔ratti,
 * approximate dimensions, and how much to wear. Opened from the product page.
 */

const caratTable = [
  { carat: "3.00 ct", ratti: "~3.3 ratti", mm: "~8 mm", note: "Entry / light effect" },
  { carat: "5.00 ct", ratti: "~5.5 ratti", mm: "~9–10 mm", note: "Most recommended" },
  { carat: "7.00 ct", ratti: "~7.7 ratti", mm: "~11 mm", note: "Strong effect" },
  { carat: "10.0 ct", ratti: "~11 ratti", mm: "~12–13 mm", note: "For experienced wearers" },
];

export function CaratGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[2rem] border border-foreground/10 bg-cosmos shadow-2xl"
          >
            {/* header */}
            <div className="sticky top-0 flex items-center justify-between border-b border-foreground/10 bg-cosmos/95 px-6 py-5 backdrop-blur-xl">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-500 text-white">
                  <Ruler size={18} />
                </span>
                <h3 className="text-lg font-semibold text-foreground">
                  Carat &amp; Size Guide
                </h3>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-7 p-6">
              {/* intro */}
              <p className="text-sm leading-relaxed text-muted">
                Gemstones are measured in <strong className="text-foreground">carats</strong>{" "}
                (weight), while Indian astrology often uses{" "}
                <strong className="text-foreground">ratti</strong>. Here&apos;s a
                quick guide to choosing the right size.
              </p>

              {/* conversion facts */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Fact
                  icon={Scale}
                  title="1 Carat = 0.2 grams"
                  desc="The standard unit of gemstone weight worldwide."
                />
                <Fact
                  icon={Sparkles}
                  title="1 Carat ≈ 1.1 Ratti"
                  desc="Ratti is the traditional unit used in Vedic astrology."
                />
              </div>

              {/* table */}
              <div className="overflow-hidden rounded-2xl border border-foreground/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-foreground/[0.04] text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Carat</th>
                      <th className="px-4 py-3 font-semibold">Ratti</th>
                      <th className="px-4 py-3 font-semibold">Approx size</th>
                      <th className="px-4 py-3 font-semibold">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caratTable.map((row, i) => (
                      <tr
                        key={row.carat}
                        className={i % 2 ? "bg-foreground/[0.015]" : ""}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          {row.carat}
                        </td>
                        <td className="px-4 py-3 text-muted">{row.ratti}</td>
                        <td className="px-4 py-3 text-muted">{row.mm}</td>
                        <td className="px-4 py-3 text-muted">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* how much to wear */}
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  How many carats should I wear?
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  A common traditional guideline is roughly{" "}
                  <strong className="text-foreground">1 ratti per 10 kg</strong>{" "}
                  of body weight — but this is only a rule of thumb. The ideal
                  weight depends on your birth chart, the planet&apos;s strength
                  and the stone type.
                </p>
              </div>

              {/* tip */}
              <div className="flex items-start gap-3 rounded-2xl border border-gold-400/25 bg-gold-400/5 p-4">
                <Info size={18} className="mt-0.5 shrink-0 text-gold-600" />
                <p className="text-sm leading-relaxed text-foreground">
                  Not sure what suits you? Book a{" "}
                  <strong>free consultation</strong> — our astrologers will
                  recommend the exact carat, metal and stone for your chart.
                </p>
              </div>

              <Button
                variant="gold"
                size="lg"
                className="w-full"
                onClick={onClose}
              >
                Got it
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Fact({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-nebula p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600">
        <Icon size={17} />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">{desc}</p>
    </div>
  );
}
