/** Popups module — public API. */
export { popupController } from "./popup.controller";
export { popupService } from "./popup.service";
export {
  createPopupSchema,
  updatePopupSchema,
  popupSubmissionSchema,
  popupEventSchema,
  type CreatePopupDto,
  type UpdatePopupDto,
  type PopupSubmissionDto,
  type PopupEventDto,
} from "./popup.schema";
export type {
  Popup,
  PublicPopup,
  PopupType,
  PopupLayout,
  PopupCorner,
  PopupTriggerType,
  PopupFrequency,
  PopupDevice,
  PopupAudience,
  PopupAuth,
  PopupPageMode,
  PopupCta,
  PopupContent,
  PopupDesign,
  PopupTargeting,
  PopupTrigger,
  PopupFrequencyRule,
  PopupAnalytics,
  PopupEvent,
} from "./popup.types";
