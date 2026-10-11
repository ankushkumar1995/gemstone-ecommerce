/** Customers module — public API. */
export { customerController } from "./customer.controller";
export { customerService } from "./customer.service";
export {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerDto,
  type UpdateCustomerDto,
} from "./customer.schema";
export type {
  Customer,
  CustomerStatus,
  CustomerAddress,
  CustomerActivity,
} from "./customer.types";
