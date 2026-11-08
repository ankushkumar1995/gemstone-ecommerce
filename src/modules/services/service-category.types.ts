/**
 * Service categories (admin managed). A service stores the category `id`, so
 * renaming a category never breaks services. Services without a category
 * (all services created before categories existed) are "Uncategorised" and
 * keep working exactly as before.
 */

export interface ServiceCategory {
  id: string;
  name: string;
  /** Public URL part: /services?category=<slug> */
  slug: string;
  icon: string;
  description: string;
  visible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCategoryRow extends ServiceCategory {
  serviceCount: number;
}

export interface ServiceCategoryList {
  categories: ServiceCategoryRow[];
  /** Services with no category. */
  uncategorised: number;
}
