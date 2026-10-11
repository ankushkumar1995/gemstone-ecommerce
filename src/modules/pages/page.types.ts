/**
 * Pages (CMS) domain — types. Admin-managed static content pages (About,
 * Shipping Policy, Terms, Privacy…) served by the storefront at /pages/:slug.
 * Content is rich HTML authored in the admin WYSIWYG editor.
 */

export type PageStatus = "draft" | "published";

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  content: string; // rich HTML
  status: PageStatus;
  seoTitle?: string;
  seoDescription?: string;
  showInFooter: boolean; // surface in the storefront footer links
  updatedAt: string;
  createdAt: string;
}

export interface CreatePageInput {
  title: string;
  content?: string;
  status?: PageStatus;
  seoTitle?: string;
  seoDescription?: string;
  showInFooter?: boolean;
}
