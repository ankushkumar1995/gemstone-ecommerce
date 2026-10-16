import type { Metadata } from "next";
import { serviceService } from "@/modules/services";
import { ServicesView } from "@/components/services/services-view";

export const metadata: Metadata = {
  title: "Astrology Services — Astrounkle",
  description:
    "Book expert Vedic astrology services — kundli analysis, gemstone consultation, kundli matching, career guidance, vastu, muhurat, numerology and live astrologer calls.",
};

// Services are admin-managed — always render the latest active set.
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const res = await serviceService.listActive();
  return <ServicesView services={res.ok ? res.value : []} />;
}
