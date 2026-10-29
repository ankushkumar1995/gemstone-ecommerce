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
import { PopupManager } from "@/components/layout/popup-manager";
import { settingsService } from "@/modules/settings";
import { popupService } from "@/modules/popups";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationSchema, websiteSchema, astrologyServiceSchema } from "@/lib/seo";

// Title/description/keywords are inherited from the root layout (brand-driven),
// so individual pages only override what they need.

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

  const popupsRes = await popupService.liveForPublic();
  const livePopups = popupsRes.ok ? popupsRes.value : [];
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
            <JsonLd
              data={[
                organizationSchema(),
                websiteSchema(),
                astrologyServiceSchema(),
              ]}
            />
            <AnnouncementBar />
            <Navbar />
            <main className="relative min-h-screen">{children}</main>
            <Footer />
            <CartDrawer />
            <WhatsAppFloat />
            <CookieConsent />
            <PopupManager popups={livePopups} />
          </StoreSettingsProvider>
        </CommerceProvider>
      </CurrencyProvider>
    </ToastProvider>
  );
}
