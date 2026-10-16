/** Orders module — public API. */
export { orderController } from "./order.controller";
export { orderService } from "./order.service";
export { getOrderRepository } from "./order.repository";
export {
  createOrderSchema,
  updateStatusSchema,
  updatePaymentSchema,
  updateFulfillmentSchema,
  type CreateOrderDto,
  type UpdateStatusDto,
  type UpdatePaymentDto,
  type UpdateFulfillmentDto,
  type UpdateOrderDetailsDto,
} from "./order.schema";
export type {
  Order,
  OrderStatus,
  OrderItem,
  OrderAddress,
  OrderPricing,
  OrderFulfillment,
  OrderActivity,
  PaymentStatus,
  PaymentMethod,
} from "./order.types";
export { ORDER_PIPELINE } from "./order.types";
