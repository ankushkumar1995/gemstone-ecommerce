"use client";

/**
 * StoreSettingsProvider — makes admin-managed storefront settings (contact
 * details, store name, etc.) available to any client component via
 * `useStoreSettings()`. The value is fetched once on the server (in the site
 * layout) and passed down, so there's no client fetch waterfall.
 */

import { createContext, useContext, type ReactNode } from "react";

export interface StorePublicSettings {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  address: string;
}

export const DEFAULT_STORE_SETTINGS: StorePublicSettings = {
  storeName: "Astrounkle",
  supportEmail: "care@astrounkle.com",
  supportPhone: "+91 90000 00000",
  whatsappNumber: "+91 90000 00000",
  address: "Jaipur, Rajasthan, India",
};

const Ctx = createContext<StorePublicSettings>(DEFAULT_STORE_SETTINGS);

export function StoreSettingsProvider({
  value,
  children,
}: {
  value: StorePublicSettings;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStoreSettings(): StorePublicSettings {
  return useContext(Ctx);
}

/** Digits-only phone for tel: and wa.me links (e.g. "+91 90000 00000" → "919000000000"). */
export function phoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}
