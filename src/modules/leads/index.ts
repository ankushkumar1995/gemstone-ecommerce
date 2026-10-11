/**
 * Leads module — public API.
 *
 * Everything outside this module imports from here, not from internal files.
 * This keeps the module encapsulated: internals can change freely, and the
 * whole folder can be lifted into a standalone microservice later.
 */

export { leadController } from "./lead.controller";
export { leadService } from "./lead.service";
export { createLeadSchema } from "./lead.schema";
export type {
  Lead,
  LeadSource,
  LeadStatus,
  CreateLeadInput,
} from "./lead.types";
