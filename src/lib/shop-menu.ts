import "server-only";

import { cache } from "@/core/cache";
import { categoryService } from "@/modules/categories";
import { productService } from "@/modules/products";
import {
  EMPTY_SHOP_MENU,
  type ShopMenuCategory,
  type ShopMenuData,
  type ShopMenuProduct,
} from "./shop-menu.types";

const MAX_CATEGORIES = 8;
const MAX_PRODUCTS = 4;
const TTL = 60; // seconds

const isActive = (s?: string) => (s ?? "active") === "active";

/**
 * Data for the storefront "Shop All" mega menu, straight from the admin:
 *  - active top-level categories (admin order) with their active sub-categories
 *  - featured active products (falls back to other active products)
 *
 * Runs on every storefront page via the site layout, so it is cached. The
 * product part lives under the "products:" prefix and the category part under
 * "categories:" so any admin write to either clears it immediately. It never
 * throws: a DB problem just renders an empty menu instead of breaking the page.
 */
export async function getShopMenu(): Promise<ShopMenuData> {
  const [categories, products] = await Promise.all([
    cache
      .wrap("categories:menu", TTL, async (): Promise<ShopMenuCategory[]> => {
        const res = await categoryService.tree();
        if (!res.ok) return [];
        return res.value
          .filter((c) => isActive(c.status))
          .slice(0, MAX_CATEGORIES)
          .map((c) => ({
            slug: c.slug,
            title: c.title,
            tagline: c.tagline ?? "",
            image: c.image,
            tint: c.tint ?? "",
            children: c.children
              .filter((k) => isActive(k.status))
              .map((k) => ({ slug: k.slug, title: k.title })),
          }));
      })
      .catch(() => [] as ShopMenuCategory[]),

    cache
      .wrap("products:menu", TTL, async (): Promise<ShopMenuProduct[]> => {
        const res = await productService.listFeatured(MAX_PRODUCTS);
        if (!res.ok) return [];
        return res.value.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          image: p.image || p.images?.[0] || "",
          price: p.price,
          mrp: p.mrp,
          ...(p.badge ? { badge: p.badge } : {}),
        }))
        // a tile without a photo would render broken; skip it
        .filter((p) => p.image !== "");
      })
      .catch(() => [] as ShopMenuProduct[]),
  ]);

  return categories.length || products.length ? { categories, products } : EMPTY_SHOP_MENU;
}
