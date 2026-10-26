"use client";

import Link from "next/link";
import { Star, Moon, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AstroToolView, ToolProse, ResultHeading } from "./astro-tool-view";

export function NakshatraView() {
  return (
    <AstroToolView
      breadcrumb="Nakshatra Finder"
      badge="Birth Star · Instant"
      badgeIcon={Star}
      titleTop="Nakshatra (Birth Star)"
      titleAccent="Finder"
      intro="Discover your birth Nakshatra (lunar mansion) and Pada by date, time and place of birth. Among the 27 Nakshatras, your birth star reveals your deeper nature, ruling planet and the foundation of your Vimshottari Dasha."
      cta="Find My Nakshatra"
      renderResult={(d) => (
        <div className="mx-auto max-w-2xl">
          <ResultHeading icon={Star}>Your Birth Nakshatra</ResultHeading>
          <div className="rounded-[2rem] border border-gold-400/25 bg-gradient-to-br from-gold-400/[0.07] to-nebula p-8 text-center">
            <p className="text-sm text-muted">{d.name}, born in {d.place}</p>
            <p className="mt-3 font-display text-5xl font-bold text-gradient-gold">{d.nakshatra.name}</p>
            <p className="mt-2 text-lg text-foreground">Pada {d.nakshatra.pada}</p>
            <p className="mt-3 text-sm text-muted">
              Ruling planet: <span className="font-semibold text-gold-600">{d.nakshatra.lord}</span>
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <MiniCard icon={Moon} label="Moon Sign" value={d.moonSign.rashi} />
            <MiniCard icon={Compass} label="Ascendant" value={d.ascendant.rashi} />
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/free-kundli"><Button variant="gold" size="lg">See Full Kundli</Button></Link>
            <Link href="/#free-consultation"><Button variant="outline" size="lg">Free Consultation</Button></Link>
          </div>
        </div>
      )}
    >
      <ToolProse>
        <h2 className="font-display text-2xl font-semibold text-foreground">What is a Nakshatra?</h2>
        <p>
          A Nakshatra is one of the 27 lunar mansions the Moon travels through, each spanning 13°20&apos;
          of the zodiac and divided into four Padas (quarters). Your birth Nakshatra — the one the
          Moon occupied when you were born — is a cornerstone of Vedic astrology, used for your
          personality analysis, Vimshottari Dasha timeline, baby-naming (Namakaran) and Kundli
          Matching for marriage.
        </p>
      </ToolProse>
    </AstroToolView>
  );
}

function MiniCard({ icon: Icon, label, value }: { icon: typeof Moon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-nebula p-4 text-center">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500/15 to-gold-400/20 text-gold-600"><Icon size={17} /></span>
      <p className="mt-2 text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
