"use client";

import Link from "next/link";
import { Moon, Sun, Compass, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AstroToolView, ToolProse, ResultHeading } from "./astro-tool-view";

export function MoonSignView() {
  return (
    <AstroToolView
      breadcrumb="Moon Sign Calculator"
      badge="Rashi · Instant"
      badgeIcon={Moon}
      titleTop="Moon Sign (Rashi)"
      titleAccent="Calculator"
      intro="Find your Vedic Moon sign (Rashi) by date, time and place of birth. In Vedic astrology your Moon sign — not your Sun sign — is the heart of your chart, governing your mind, emotions and life-timing periods."
      cta="Find My Moon Sign"
      renderResult={(d) => (
        <div className="mx-auto max-w-2xl">
          <ResultHeading icon={Moon}>Your Moon Sign</ResultHeading>
          <div className="rounded-[2rem] border border-gold-400/25 bg-gradient-to-br from-gold-400/[0.07] to-nebula p-8 text-center">
            <p className="text-sm text-muted">{d.name}, born in {d.place}</p>
            <p className="mt-3 font-display text-5xl font-bold text-gradient-gold">{d.moonSign.rashi}</p>
            <p className="mt-1 text-lg text-foreground">{d.moonSign.rashiSanskrit}</p>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted">
              <Star size={13} className="fill-gold-500 text-gold-500" />
              Birth Nakshatra: <span className="font-semibold text-foreground">{d.nakshatra.name}</span> (Pada {d.nakshatra.pada})
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <MiniCard icon={Sun} label="Sun Sign" value={d.sunSign.rashi} />
            <MiniCard icon={Compass} label="Ascendant" value={d.ascendant.rashi} />
          </div>

          <div className="mt-6 rounded-2xl border border-foreground/10 bg-nebula p-5 text-center text-sm text-muted">
            Your lucky gemstone for this Moon sign is{" "}
            <span className="font-semibold text-gold-600">{d.gemstones.lucky.gem} ({d.gemstones.lucky.hindi})</span>.
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/free-kundli"><Button variant="gold" size="lg">See Full Kundli</Button></Link>
            <Link href={`/shop?search=${encodeURIComponent(d.gemstones.lucky.shopQuery)}`}>
              <Button variant="outline" size="lg">Shop {d.gemstones.lucky.gem}</Button>
            </Link>
          </div>
        </div>
      )}
    >
      <ToolProse>
        <h2 className="font-display text-2xl font-semibold text-foreground">What is a Moon sign (Rashi)?</h2>
        <p>
          Your Moon sign is the zodiac sign the Moon occupied at the exact moment of your birth,
          measured on the sidereal zodiac used in Vedic astrology. While Western astrology leans on
          the Sun sign, Vedic astrology (Jyotish) treats the Moon sign and its Nakshatra as the core
          of the horoscope — they shape your emotions, instincts and the Vimshottari Dasha periods
          that time the events of your life.
        </p>
        <h2 className="font-display text-2xl font-semibold text-foreground">Why your Moon sign matters</h2>
        <p>
          Daily rashifal, kundli matching for marriage and gemstone recommendations are all based on
          your Moon sign. Knowing your correct Rashi is the first step to understanding your chart —
          and choosing the right astrological gemstone.
        </p>
      </ToolProse>
    </AstroToolView>
  );
}

function MiniCard({ icon: Icon, label, value }: { icon: typeof Sun; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-nebula p-4 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600"><Icon size={17} /></span>
      <p className="mt-2 text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
