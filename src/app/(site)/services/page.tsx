import type { Metadata } from "next";
import { serviceService } from "@/modules/services";
import { ServicesView } from "@/components/services/services-view";

export const metadata: Metadata = {
  title: "Online Astrology Consultation & Vedic Services in India",
  description:
    "Book an online astrology consultation with the best Vedic astrologers in India — kundli analysis, kundli matching, gemstone consultation, career, marriage & medical astrology, vastu, muhurat and numerology over call or video.",
  keywords: [
    "online astrology consultation",
    "vedic astrology consultation",
    "consult astrologer online",
    "best astrologer in India",
    "kundli analysis",
    "kundli matching",
    "marriage astrology consultation",
    "career astrology consultation",
    "gemstone consultation",
    "astrology phone consultation",
    "astrology video consultation",
  ],
  alternates: { canonical: "/services" },
};

// Services are admin-managed — always render the latest active set.
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const res = await serviceService.listActive();
  return <ServicesView services={res.ok ? res.value : []} />;
}
