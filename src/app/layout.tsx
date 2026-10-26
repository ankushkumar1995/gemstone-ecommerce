import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BRAND } from "@/lib/brand";
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
  metadataBase: new URL(BRAND.url),
  title: {
    default: BRAND.metaTitle,
    // Every page that sets its own `title` gets "<Page> — Astrounkle" applied.
    template: `%s — ${BRAND.name}`,
  },
  description: BRAND.metaDescription,
  keywords: BRAND.keywords,
  applicationName: BRAND.name,
  authors: [{ name: BRAND.name, url: BRAND.url }],
  creator: BRAND.name,
  publisher: BRAND.name,
  alternates: { canonical: "/" },
  category: "Astrology & Gemstones",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: BRAND.url,
    siteName: BRAND.name,
    title: BRAND.metaTitle,
    description: BRAND.metaDescription,
    images: [
      {
        url: "/images/image1.png",
        width: 1200,
        height: 630,
        alt: `${BRAND.name} — Online Astrology Consultation & Certified Gemstones`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.metaTitle,
    description: BRAND.metaDescription,
    images: ["/images/image1.png"],
  },
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
