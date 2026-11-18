/** Partner agreements module — public API (server). Types live in ./agreement.types. */
export { agreementService, OTP_LOCK_MS, OTP_MAX_PER_HOUR, OTP_RESEND_MS, OTP_TTL_MS } from "./agreement.service";
export {
  createDraftSchema, draftUpdateSchema, extensionSchema, otpRequestSchema, publishSchema, remindSchema, signSchema, voidSchema,
} from "./agreement.schema";
export type * from "./agreement.types";
