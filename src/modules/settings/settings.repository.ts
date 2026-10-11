/**
 * Settings domain — repository. A single in-memory settings document seeded
 * with sensible defaults (mirroring the values previously hardcoded in
 * checkout). Swap for Mongo later via getSettingsRepository().
 */

import { env } from "@/core/config/env";
import type { StoreSettings } from "./settings.types";

export interface SettingsRepository {
  get(): Promise<StoreSettings>;
  update(next: StoreSettings): Promise<StoreSettings>;
}

const DEFAULT_SETTINGS: StoreSettings = {
  general: {
    storeName: "Nakshatra",
    tagline: "Certified gemstones, astrologically energised.",
    logo: "",
    supportEmail: "support@nakshatra.com",
    supportPhone: "+91 90000 00000",
    whatsappNumber: "+91 90000 00000",
    address: "Jaipur, Rajasthan, India",
    timezone: "Asia/Kolkata",
  },
  shipping: {
    freeShippingThreshold: 5000,
    flatRate: 199,
    deliveryEstimate: "3–5 business days",
    zones: [
      { id: "zone_in", name: "India", rate: 199, freeAbove: 5000 },
      { id: "zone_intl", name: "International", rate: 2499, freeAbove: 50000 },
    ],
  },
  tax: {
    rate: 3,
    gstin: "",
    inclusive: false,
  },
  localization: {
    defaultCurrency: "INR",
    enabledCurrencies: ["INR", "USD", "EUR", "GBP", "AED"],
    numberFormat: "en-IN",
    dateFormat: "DD/MM/YYYY",
  },
  payments: {
    methods: { cod: true, card: true, upi: true, netbanking: false },
    gateway: "none",
    razorpayKeyId: "",
    stripePublishableKey: "",
  },
  checkout: {
    guestCheckout: true,
    requirePhone: true,
    minOrderValue: 0,
    termsText: "By placing this order you agree to our terms & conditions and refund policy.",
  },
  notifications: {
    adminAlertEmail: "orders@nakshatra.com",
    sendOrderConfirmation: true,
    sendShippingUpdate: true,
    orderConfirmationTemplate:
      "Hi {{customer}}, thank you for your order {{orderNumber}}! We'll notify you once it ships.",
  },
  seo: {
    metaTitle: "Nakshatra — Certified Gemstones & Astrology",
    metaDescription: "Buy certified, astrologically energised natural gemstones. Rings, pendants and loose stones.",
    ogImage: "",
    instagram: "",
    facebook: "",
    youtube: "",
    googleAnalyticsId: "",
  },
  team: {
    members: [
      { id: "tm_1", name: "Store Admin", email: "admin@nakshatra.com", role: "admin" },
    ],
  },
  appearance: {
    accentColor: "#c9942a",
    secondaryColor: "#6a2ee0",
    fontFamily: "Inter",
    borderRadius: "soft",
  },
  inventory: {
    lowStockThreshold: 3,
    outOfStockBehaviour: "show_sold_out",
    stockDisplay: "in_out",
    skuPattern: "{CAT}-{SEQ}",
  },
  order: {
    numberPrefix: "NK",
    autoCancelUnpaidHours: 48,
    minQtyPerItem: 1,
    maxQtyPerItem: 0,
  },
  email: {
    fromName: "Nakshatra",
    fromEmail: "orders@nakshatra.com",
    replyTo: "support@nakshatra.com",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpConfigured: false,
  },
  updatedAt: new Date().toISOString(),
};

let doc: StoreSettings = { ...DEFAULT_SETTINGS };

const mockSettingsRepository: SettingsRepository = {
  async get() {
    return { ...doc };
  },
  async update(next) {
    doc = { ...next };
    return { ...doc };
  },
};

export function getSettingsRepository(): SettingsRepository {
  switch (env.DATA_SOURCE) {
    case "mongo":
      throw new Error("Mongo settings repository not implemented yet");
    case "mock":
    default:
      return mockSettingsRepository;
  }
}
