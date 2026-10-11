/** Products module — public API. */
export { productController } from "./product.controller";
export { productService } from "./product.service";
export {
  createProductSchema,
  updateProductSchema,
  type CreateProductDto,
  type UpdateProductDto,
} from "./product.schema";
