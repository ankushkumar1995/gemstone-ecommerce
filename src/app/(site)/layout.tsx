import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { CommerceProvider } from "@/lib/store";
import { CurrencyProvider } from "@/lib/currency";
import { ToastProvider } from "@/lib/toast";
import { StoreSettingsProvider, DEFAULT_STORE_SETTINGS } from "@/lib/store-settings";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { WhatsAppFloat } from "@/components/layout/whatsapp-float";
import { CookieConsent } from "@/components/layout/cookie-consent";
import { settingsService } from "@/modules/settings";

export const metadata: Metadata = {
  title: "Astrounkle — Luxury Gemstones & Astrology",
  description:
    "Discover certified natural gemstones curated by your zodiac. Premium stones with lab certification and expert astrological guidance.",
  keywords: [
    "gemstones",
    "astrology",
    "ratna",
    "certified gemstones",
    "zodiac stones",
  ],
};

/**
 * STOREFRONT layout — all customer-facing chrome lives here (navbar, footer,
 * cart drawer, WhatsApp, cookie banner) plus the client providers. The admin
 * area is a separate route and never sees any of this.
 */
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const res = await settingsService.get();
  const g = res.ok ? res.value.general : null;
  const storeSettings = g
    ? {
        storeName: g.storeName || DEFAULT_STORE_SETTINGS.storeName,
        supportEmail: g.supportEmail || DEFAULT_STORE_SETTINGS.supportEmail,
        supportPhone: g.supportPhone || DEFAULT_STORE_SETTINGS.supportPhone,
        whatsappNumber: g.whatsappNumber || DEFAULT_STORE_SETTINGS.whatsappNumber,
        address: g.address || DEFAULT_STORE_SETTINGS.address,
      }
    : DEFAULT_STORE_SETTINGS;

  return (
    <ToastProvider>
      <CurrencyProvider>
        <CommerceProvider>
          <StoreSettingsProvider value={storeSettings}>
            <AnnouncementBar />
            <Navbar />
            <main className="relative min-h-screen">{children}</main>
            <Footer />
            <CartDrawer />
            <WhatsAppFloat />
            <CookieConsent />
          </StoreSettingsProvider>
        </CommerceProvider>
      </CurrencyProvider>
    </ToastProvider>
  );
}
