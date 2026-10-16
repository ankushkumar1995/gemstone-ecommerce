import type { StoreSettings } from "@/modules/settings/settings.types";

/**
 * Default store settings — the single source of truth for both the repository
 * fallback and the seed script (so the DB and the in-memory default match).
 */
export const DEFAULT_SETTINGS: StoreSettings = {
  general: {
    storeName: "Astrounkle",
    tagline: "Certified gemstones, astrologically energised.",
    logo: "",
    supportEmail: "support@astrounkle.com",
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
    adminAlertEmail: "orders@astrounkle.com",
    sendOrderConfirmation: true,
    sendShippingUpdate: true,
    orderConfirmationTemplate:
      "Hi {{customer}}, thank you for your order {{orderNumber}}! We'll notify you once it ships.",
  },
  seo: {
    metaTitle: "Astrounkle — Certified Gemstones & Astrology",
    metaDescription:
      "Buy certified, astrologically energised natural gemstones. Rings, pendants and loose stones.",
    ogImage: "",
    instagram: "",
    facebook: "",
    youtube: "",
    googleAnalyticsId: "",
  },
  team: {
    members: [{ id: "tm_1", name: "Store Admin", email: "admin@astrounkle.com", role: "admin" }],
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
    fromName: "Astrounkle",
    fromEmail: "orders@astrounkle.com",
    replyTo: "support@astrounkle.com",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpConfigured: false,
  },
  updatedAt: new Date().toISOString(),
};
