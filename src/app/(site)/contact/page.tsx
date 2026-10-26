import type { Metadata } from "next";
import { ContactView } from "@/components/contact/contact-view";

export const metadata: Metadata = {
  title: "Contact Us — Talk to an Astrologer or Gemstone Expert",
  description:
    "Get in touch with Astrounkle for gemstone guidance, order help or a free astrology consultation. Call, WhatsApp, email or send us a message — we reply within 24 hours.",
  keywords: [
    "contact astrologer",
    "talk to astrologer",
    "gemstone expert contact",
    "astrology consultation contact",
    "free astrology consultation",
  ],
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return <ContactView />;
}
