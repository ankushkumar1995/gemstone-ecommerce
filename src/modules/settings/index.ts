/** Settings module — public API. */
export { settingsController } from "./settings.controller";
export { settingsService } from "./settings.service";
export {
  updateSettingsSchema,
  type UpdateSettingsDto,
} from "./settings.schema";
export type {
  StoreSettings,
  StoreGeneralSettings,
  ShippingSettings,
  ShippingZone,
  TaxSettings,
  LocalizationSettings,
  PaymentsSettings,
  PaymentMethodKey,
  CheckoutSettings,
  NotificationSettings,
  SeoSettings,
  TeamMember,
  TeamSettings,
  AppearanceSettings,
  InventorySettings,
  OrderSettings,
  EmailSettings,
} from "./settings.types";
