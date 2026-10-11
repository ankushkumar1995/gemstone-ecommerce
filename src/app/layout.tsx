import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * ROOT layout — intentionally minimal.
 *
 * It only sets up <html>/<body> and fonts. It does NOT render any navbar,
 * footer or providers, so the two sides of the app stay fully separate:
 *   - (site)  → customer storefront chrome (navbar, footer, cart, etc.)
 *   - admin   → its own standalone layout (sidebar + topbar)
 */
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const display = Inter({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nakshatra — Luxury Gemstones & Astrology",
  description:
    "Certified natural gemstones curated by your zodiac, with expert astrological guidance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${display.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
