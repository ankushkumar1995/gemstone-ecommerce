/**
 * Settings domain — types. Store-wide configuration, a SINGLE document
 * (not a list). Other modules/pages read these values instead of hardcoding
 * them (e.g. checkout reads shipping thresholds, orders read the tax rate).
 */

export interface StoreGeneralSettings {
  storeName: string;
  tagline?: string;
  logo?: string;
  supportEmail?: string;
  supportPhone?: string;
  whatsappNumber?: string;
  address?: string;
  timezone: string; // e.g. "Asia/Kolkata"
}

export interface ShippingZone {
  id: string;
  name: string; // e.g. "India", "International"
  rate: number;
  freeAbove?: number; // free shipping threshold for this zone
}

export interface ShippingSettings {
  /** order subtotal at/above which shipping is free */
  freeShippingThreshold: number;
  /** flat shipping charge below the threshold */
  flatRate: number;
  /** delivery estimate shown to customers, e.g. "3–5 business days" */
  deliveryEstimate?: string;
  /** optional per-zone rates (India / International …) */
  zones: ShippingZone[];
}

export interface TaxSettings {
  /** default tax / GST percentage applied to orders */
  rate: number;
  /** GSTIN printed on invoices */
  gstin?: string;
  /** whether displayed prices already include tax */
  inclusive: boolean;
}

export interface LocalizationSettings {
  /** default currency code, e.g. "INR" */
  defaultCurrency: string;
  /** currency codes enabled in the storefront selector */
  enabledCurrencies: string[];
  /** number grouping style */
  numberFormat: "en-IN" | "en-US" | "en-GB";
  /** date display style */
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
}

export type PaymentMethodKey = "cod" | "card" | "upi" | "netbanking";

export interface PaymentsSettings {
  /** which payment methods are offered at checkout */
  methods: Record<PaymentMethodKey, boolean>;
  /** payment gateway (demo keys for now) */
  gateway: "none" | "razorpay" | "stripe";
  razorpayKeyId?: string;
  stripePublishableKey?: string;
}

export interface CheckoutSettings {
  guestCheckout: boolean;
  requirePhone: boolean;
  minOrderValue: number; // 0 = no minimum
  termsText?: string;
}

export interface NotificationSettings {
  /** email that receives new-order alerts */
  adminAlertEmail?: string;
  sendOrderConfirmation: boolean;
  sendShippingUpdate: boolean;
  orderConfirmationTemplate?: string;
}

export interface SeoSettings {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  instagram?: string;
  facebook?: string;
  youtube?: string;
  googleAnalyticsId?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff";
}

export interface TeamSettings {
  members: TeamMember[];
}

export interface AppearanceSettings {
  accentColor: string; // hex, e.g. "#c9942a"
  secondaryColor: string;
  fontFamily: "Inter" | "Poppins" | "Manrope" | "DM Sans";
  borderRadius: "sharp" | "soft" | "round";
}

export interface InventorySettings {
  /** qty at/below which an item is "low stock" (admin alerts + highlight) */
  lowStockThreshold: number;
  /** what the storefront does when a product is out of stock */
  outOfStockBehaviour: "hide" | "show_sold_out" | "allow_backorder";
  /** how stock is shown to customers */
  stockDisplay: "exact" | "in_out" | "hidden";
  /** auto-SKU pattern; {CAT} = category code, {SEQ} = running number */
  skuPattern: string;
}

export interface OrderSettings {
  /** order number prefix, e.g. "NK" → NK-2026-1234 */
  numberPrefix: string;
  /** auto-cancel unpaid orders after this many hours (0 = never) */
  autoCancelUnpaidHours: number;
  /** per-product quantity limits in a single order */
  minQtyPerItem: number;
  maxQtyPerItem: number; // 0 = no max
}

export interface EmailSettings {
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  /** demo only — never store a real password in mock settings */
  smtpConfigured: boolean;
}

export interface StoreSettings {
  general: StoreGeneralSettings;
  shipping: ShippingSettings;
  tax: TaxSettings;
  localization: LocalizationSettings;
  payments: PaymentsSettings;
  checkout: CheckoutSettings;
  notifications: NotificationSettings;
  seo: SeoSettings;
  team: TeamSettings;
  appearance: AppearanceSettings;
  inventory: InventorySettings;
  order: OrderSettings;
  email: EmailSettings;
  updatedAt: string; // ISO
}
