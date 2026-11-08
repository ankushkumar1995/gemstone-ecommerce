/**
 * Slim, client-safe shapes for the "Shop All" mega menu. Built on the server
 * from the admin-managed categories + products, so the navbar never ships the
 * full product documents to the browser.
 */

export interface ShopMenuSubCategory {
  slug: string;
  title: string;
}

export interface ShopMenuCategory {
  slug: string;
  title: string;
  tagline: string;
  image: string;
  tint: string;
  children: ShopMenuSubCategory[];
}

export interface ShopMenuProduct {
  id: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  mrp: number;
  badge?: string;
}

export interface ShopMenuData {
  categories: ShopMenuCategory[];
  products: ShopMenuProduct[];
}

export const EMPTY_SHOP_MENU: ShopMenuData = { categories: [], products: [] };
