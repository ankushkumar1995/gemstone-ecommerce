import type { Metadata } from "next";
import { ContactView } from "@/components/contact/contact-view";

export const metadata: Metadata = {
  title: "Contact Us — Astrounkle",
  description:
    "Get in touch with Astrounkle for gemstone guidance, order help or a free astrology consultation. Call, email or send us a message.",
};

export default function ContactPage() {
  return <ContactView />;
}
