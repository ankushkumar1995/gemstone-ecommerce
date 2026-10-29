/** Email module — public API. */
export { emailController } from "./email.controller";
export { emailService } from "./email.service";
export { EMAIL_EVENTS, eventMeta, renderTemplate, htmlToText } from "./email.catalog";
export {
  createTemplateSchema,
  updateTemplateSchema,
  testEmailSchema,
  type CreateTemplateDto,
  type UpdateTemplateDto,
  type TestEmailDto,
} from "./email.schema";
export type {
  EmailTemplate,
  EmailLog,
  EmailLogStatus,
  EmailEventKey,
  EmailEventMeta,
  CreateEmailTemplateInput,
} from "./email.types";
