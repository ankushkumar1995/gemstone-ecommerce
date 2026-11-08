/** Services module — public API. */
export { serviceController } from "./service.controller";
export { serviceService } from "./service.service";
export { serviceCategoryService } from "./service-category.service";
export type { ServiceCategory, ServiceCategoryRow, ServiceCategoryList } from "./service-category.types";
export {
  createServiceSchema,
  updateServiceSchema,
  createServiceCategorySchema,
  updateServiceCategorySchema,
  reorderServiceCategoriesSchema,
  deleteServiceCategorySchema,
  SERVICE_ICONS,
  type CreateServiceDto,
  type UpdateServiceDto,
  type CreateServiceCategoryDto,
  type UpdateServiceCategoryDto,
} from "./service.schema";
