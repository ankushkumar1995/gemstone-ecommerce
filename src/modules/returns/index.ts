/** Returns (RMA) module — public API. */
export { returnController } from "./return.controller";
export { returnService } from "./return.service";
export {
  createReturnSchema,
  updateReturnStatusSchema,
  addReturnNoteSchema,
  type CreateReturnDto,
  type UpdateReturnStatusDto,
  type AddReturnNoteDto,
} from "./return.schema";
export type {
  ReturnRequest,
  ReturnStatus,
  ReturnReason,
  ReturnItem,
  ReturnActivity,
} from "./return.types";
