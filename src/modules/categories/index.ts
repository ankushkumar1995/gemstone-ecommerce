/** Categories module — public API. */
export { categoryController } from "./category.controller";
export { categoryService } from "./category.service";
export {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryDto,
  type UpdateCategoryDto,
} from "./category.schema";
