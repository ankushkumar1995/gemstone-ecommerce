/** Pages (CMS) module — public API. */
export { pageController } from "./page.controller";
export { pageService } from "./page.service";
export {
  createPageSchema,
  updatePageSchema,
  type CreatePageDto,
  type UpdatePageDto,
} from "./page.schema";
export type { CmsPage, PageStatus } from "./page.types";
