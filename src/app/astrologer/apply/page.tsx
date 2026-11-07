import type { Metadata } from "next";
import { ApplyWizard } from "./apply-wizard";

export const metadata: Metadata = { title: "Become an Astrounkle astrologer" };

export default function ApplyPage() {
  return <ApplyWizard />;
}
